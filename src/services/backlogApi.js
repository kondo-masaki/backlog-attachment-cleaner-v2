import axios from 'axios';

class BacklogAPI {
  constructor(spaceUrl, apiKey) {
    this.spaceUrl = spaceUrl;
    this.apiKey = apiKey;
    // URLの末尾のスラッシュを削除し、/api/v2を追加
    this.baseURL = `${spaceUrl.replace(/\/$/, '')}/api/v2`;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      params: {
        apiKey: this.apiKey
      }
    });
    
    // レート制限情報を保持
    this.rateLimit = {
      limit: null,
      remaining: null,
      reset: null
    };
    
    // レスポンスインターセプターでレート制限情報を更新
    this.client.interceptors.response.use(
      (response) => {
        this.updateRateLimit(response.headers);
        return response;
      },
      (error) => {
        if (error.response) {
          this.updateRateLimit(error.response.headers);
        }
        return Promise.reject(error);
      }
    );
  }

  // レート制限情報を更新
  updateRateLimit(headers) {
    if (headers['x-ratelimit-limit']) {
      this.rateLimit.limit = parseInt(headers['x-ratelimit-limit'], 10);
    }
    if (headers['x-ratelimit-remaining']) {
      this.rateLimit.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    }
    if (headers['x-ratelimit-reset']) {
      this.rateLimit.reset = parseInt(headers['x-ratelimit-reset'], 10);
    }
    
    console.log(`レート制限: ${this.rateLimit.remaining}/${this.rateLimit.limit} (リセット: ${new Date(this.rateLimit.reset * 1000).toLocaleTimeString()})`);
  }

  // レート制限チェックと待機
  async checkRateLimit() {
    if (this.rateLimit.remaining !== null && this.rateLimit.remaining <= 5) {
      const now = Math.floor(Date.now() / 1000);
      const waitTime = Math.max(0, this.rateLimit.reset - now + 1); // 1秒のバッファを追加
      
      if (waitTime > 0) {
        console.log(`レート制限に近づいています。${waitTime}秒待機します...`);
        await this.sleep(waitTime * 1000);
      }
    }
  }

  // 指定時間待機
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // レート制限エラーのリトライ処理
  async executeWithRetry(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.checkRateLimit();
        return await operation();
      } catch (error) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter, 10) : Math.pow(2, attempt) * 1000; // 指数バックオフ
          
          console.log(`レート制限エラー (試行 ${attempt}/${maxRetries}): ${waitTime/1000}秒後にリトライします...`);
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          await this.sleep(waitTime);
        } else {
          throw error;
        }
      }
    }
  }

  // プロジェクト一覧を取得
  async getProjects() {
    try {
      const response = await this.client.get('/projects');
      return response.data;
    } catch (error) {
      throw new Error(`プロジェクト取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // 指定したプロジェクトの課題一覧を取得
  async getIssues(projectId, options = {}) {
    try {
      const params = {
        projectId: [projectId],
        count: 100,
        ...options
      };
      
      const response = await this.client.get('/issues', { params });
      return response.data;
    } catch (error) {
      throw new Error(`課題取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // 課題の詳細情報を取得（添付ファイル情報を含む）
  async getIssueDetail(issueId) {
    try {
      const response = await this.client.get(`/issues/${issueId}`);
      return response.data;
    } catch (error) {
      throw new Error(`課題詳細取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // 課題キーで課題を取得
  async getIssueByKey(issueKey) {
    try {
      const response = await this.client.get(`/issues/${issueKey}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // 課題が存在しない場合
      }
      throw new Error(`課題取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // 課題の添付ファイル一覧を取得
  async getIssueAttachments(issueId) {
    try {
      const response = await this.client.get(`/issues/${issueId}/attachments`);
      return response.data;
    } catch (error) {
      throw new Error(`添付ファイル取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // 課題のコメント一覧を取得
  async getIssueComments(issueId) {
    try {
      const response = await this.client.get(`/issues/${issueId}/comments`);
      return response.data;
    } catch (error) {
      throw new Error(`コメント取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // 添付ファイルを削除
  async deleteAttachment(issueId, attachmentId) {
    try {
      const response = await this.client.delete(`/issues/${issueId}/attachments/${attachmentId}`);
      return response.data;
    } catch (error) {
      throw new Error(`添付ファイル削除エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // コメントの添付ファイルを削除
  async deleteCommentAttachment(issueId, commentId, attachmentId) {
    try {
      const response = await this.client.delete(`/issues/${issueId}/comments/${commentId}/attachments/${attachmentId}`);
      return response.data;
    } catch (error) {
      throw new Error(`コメント添付ファイル削除エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // 複数の課題から添付ファイルがある課題を取得
  async getIssuesWithAttachments(projectId, issueKeyRange = null) {
    try {
      let issues = [];
      
      if (issueKeyRange && issueKeyRange.from && issueKeyRange.to) {
        // 課題キー範囲が指定されている場合、範囲内の課題を個別に取得
        const fromNum = this.extractIssueNumber(issueKeyRange.from);
        const toNum = this.extractIssueNumber(issueKeyRange.to);
        const projectKey = issueKeyRange.from.split('-')[0];
        
        console.log(`課題範囲検索: ${projectKey}-${fromNum} から ${projectKey}-${toNum}`);
        
        // 指定された範囲の課題を個別に取得
        for (let num = fromNum; num <= toNum; num++) {
          const issueKey = `${projectKey}-${num}`;
          try {
            console.log(`課題 ${issueKey} を取得中...`);
            const issue = await this.getIssueByKey(issueKey);
            if (issue === null) {
              console.log(`課題 ${issueKey} は存在しません`);
            } else if (issue.projectId == projectId) {
              console.log(`課題 ${issueKey} を取得しました`);
              issues.push(issue);
            } else {
              console.log(`課題 ${issueKey} は異なるプロジェクト (ID: ${issue.projectId}, 期待値: ${projectId}) です`);
            }
          } catch (error) {
            // 課題が存在しない場合はスキップ
            console.log(`課題 ${issueKey} が見つかりません: ${error.message}`);
          }
        }
        
        console.log(`取得した課題数: ${issues.length} 件`);
      } else {
        // 課題キー範囲が指定されていない場合、全件取得
        let offset = 0;
        const count = 100;
        
        while (true) {
          const params = {
            projectId: [projectId],
            count,
            offset
          };

          const batch = await this.client.get('/issues', { params });
          
          if (batch.data.length === 0) break;
          
          issues = issues.concat(batch.data);
          offset += count;
          
          // 最大10000件まで取得（安全のため）
          if (offset >= 10000) break;
        }
      }

      // 添付ファイルがある課題のみを抽出（課題本体とコメントの両方をチェック）
      const issuesWithAttachments = [];
      
      for (const issue of issues) {
        try {
          console.log(`課題 ${issue.issueKey} の添付ファイルをチェック中...`);
          
          // 課題本体の添付ファイルを取得（課題詳細に含まれている場合はそれを使用）
          let issueAttachments = [];
          if (issue.attachments && issue.attachments.length > 0) {
            issueAttachments = issue.attachments;
            console.log(`課題 ${issue.issueKey}: 課題本体に ${issueAttachments.length} 個の添付ファイル`);
          } else {
            // 課題詳細に含まれていない場合は別途取得
            issueAttachments = await this.getIssueAttachments(issue.id);
            console.log(`課題 ${issue.issueKey}: API経由で ${issueAttachments.length} 個の添付ファイルを取得`);
          }
          
          // コメントの添付ファイルを取得
          console.log(`課題 ${issue.issueKey}: コメント一覧を取得中...`);
          const comments = await this.getIssueComments(issue.id);
          console.log(`課題 ${issue.issueKey}: ${comments.length} 個のコメントを取得`);
          const commentAttachments = [];
          
          for (const comment of comments) {
            if (comment.attachments && comment.attachments.length > 0) {
              console.log(`課題 ${issue.issueKey}: コメント ${comment.id} に ${comment.attachments.length} 個の添付ファイル`);
              comment.attachments.forEach(attachment => {
                console.log(`  - ${attachment.name} (ID: ${attachment.id})`);
                commentAttachments.push({
                  ...attachment,
                  commentId: comment.id,
                  commentContent: comment.content,
                  isCommentAttachment: true
                });
              });
            }
          }
          
          console.log(`課題 ${issue.issueKey}: コメント添付ファイル総数 ${commentAttachments.length} 個`);
          
          // 課題本体の添付ファイルにマークを追加
          const markedIssueAttachments = issueAttachments.map(attachment => ({
            ...attachment,
            isCommentAttachment: false
          }));
          
          // 全ての添付ファイルを結合
          const allAttachments = [...markedIssueAttachments, ...commentAttachments];
          
          console.log(`課題 ${issue.issueKey}: 総添付ファイル数 ${allAttachments.length} 個`);
          
          if (allAttachments.length > 0) {
            issuesWithAttachments.push({
              ...issue,
              attachments: allAttachments
            });
            console.log(`課題 ${issue.issueKey}: 添付ファイル付き課題として追加`);
          } else {
            console.log(`課題 ${issue.issueKey}: 添付ファイルなし、スキップ`);
          }
        } catch (error) {
          console.warn(`課題 ${issue.issueKey} の添付ファイル取得に失敗:`, error.message);
        }
      }

      return issuesWithAttachments;
    } catch (error) {
      throw new Error(`添付ファイル付き課題取得エラー: ${error.message}`);
    }
  }

  // 課題キーから番号を抽出
  extractIssueNumber(issueKey) {
    const match = issueKey.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // 複数の添付ファイルを一括削除（レート制限対応）
  async deleteMultipleAttachments(deletions) {
    const results = [];
    
    console.log(`${deletions.length} 個の添付ファイルを削除開始...`);
    
    for (let i = 0; i < deletions.length; i++) {
      const deletion = deletions[i];
      console.log(`削除進行状況: ${i + 1}/${deletions.length} - ${deletion.fileName}`);
      
      try {
        const deleteOperation = async () => {
          if (deletion.isCommentAttachment && deletion.commentId) {
            // コメントの添付ファイルを削除
            return await this.deleteCommentAttachment(deletion.issueId, deletion.commentId, deletion.attachmentId);
          } else {
            // 課題本体の添付ファイルを削除
            return await this.deleteAttachment(deletion.issueId, deletion.attachmentId);
          }
        };
        
        // レート制限を考慮したリトライ処理で削除実行
        await this.executeWithRetry(deleteOperation);
        
        results.push({
          success: true,
          issueKey: deletion.issueKey,
          fileName: deletion.fileName,
          message: '削除成功'
        });
        
        console.log(`✓ ${deletion.fileName} を削除しました`);
        
      } catch (error) {
        results.push({
          success: false,
          issueKey: deletion.issueKey,
          fileName: deletion.fileName,
          message: error.message
        });
        
        console.error(`✗ ${deletion.fileName} の削除に失敗: ${error.message}`);
      }
      
      // 削除間隔を設ける（レート制限対策）
      if (i < deletions.length - 1) {
        await this.sleep(500); // 0.5秒待機
      }
    }
    
    console.log(`削除処理完了: 成功 ${results.filter(r => r.success).length}件, 失敗 ${results.filter(r => !r.success).length}件`);
    return results;
  }

  // APIキーの有効性をテスト
  async testConnection() {
    try {
      await this.client.get('/users/myself');
      return true;
    } catch (error) {
      throw new Error(`接続テストエラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }
}

export default BacklogAPI;
