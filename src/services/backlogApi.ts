import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface RateLimit {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
}

interface Issue {
  id: number;
  issueKey: string;
  attachments: Attachment[];
}

interface Attachment {
  id: number;
  name: string;
  size?: number;
  isCommentAttachment: boolean;
  commentId: number;
}

interface Comment {
  id: number;
  content: string;
  attachments: Attachment[];
}

interface CommentAttachment extends Attachment {
  commentId: number;
  commentContent: string;
  isCommentAttachment: boolean;
}

class BacklogAPI {
  private spaceUrl: string;
  private apiKey: string;
  private baseURL: string;
  private client: AxiosInstance;
  private rateLimit: RateLimit;

  constructor(spaceUrl: string, apiKey: string) {
    this.spaceUrl = spaceUrl;
    this.apiKey = apiKey;
    this.baseURL = `${spaceUrl.replace(/\/$/, '')}/api/v2`;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      params: {
        apiKey: this.apiKey
      }
    });
    
    this.rateLimit = {
      limit: null,
      remaining: null,
      reset: null
    };
    
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
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

  private updateRateLimit(headers: any) {
    if (headers['x-ratelimit-limit']) {
      this.rateLimit.limit = parseInt(headers['x-ratelimit-limit'], 10);
    }
    if (headers['x-ratelimit-remaining']) {
      this.rateLimit.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    }
    if (headers['x-ratelimit-reset']) {
      this.rateLimit.reset = parseInt(headers['x-ratelimit-reset'], 10);
    }
    
    console.log(`レート制限: ${this.rateLimit.remaining ?? '不明'}/${this.rateLimit.limit ?? '不明'} (リセット: ${this.rateLimit.reset ? new Date(this.rateLimit.reset * 1000).toLocaleTimeString() : '不明'})`);
  }

  private async checkRateLimit() {
    if (this.rateLimit.remaining !== null && this.rateLimit.remaining <= 5) {
      const now = Math.floor(Date.now() / 1000);
      const waitTime = Math.max(0, (this.rateLimit.reset ?? 0) - now + 1);
      
      if (waitTime > 0) {
        console.log(`レート制限に近づいています。${waitTime}秒待機します...`);
        await this.sleep(waitTime * 1000);
      }
    }
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.checkRateLimit();
        return await operation();
      } catch (error: any) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter, 10) : Math.pow(2, attempt) * 1000;
          
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
    throw new Error('最大リトライ回数に達しました');
  }

  public async getProjects(): Promise<any[]> {
    try {
      const response = await this.client.get('/projects');
      return response.data;
    } catch (error: any) {
      throw new Error(`プロジェクト取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  public async getIssues(projectId: string, options: any = {}): Promise<Issue[]> {
    try {
      const params = {
        projectId: [projectId],
        count: 100,
        ...options
      };
      
      const response = await this.client.get('/issues', { params });
      return response.data;
    } catch (error: any) {
      throw new Error(`課題取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  public async getIssueDetail(issueId: number): Promise<any> {
    try {
      const response = await this.client.get(`/issues/${issueId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`課題詳細取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  public async getIssueByKey(issueKey: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/issues/${issueKey}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`課題取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  public async getIssueAttachments(issueId: number): Promise<Attachment[]> {
    try {
      const response = await this.client.get(`/issues/${issueId}/attachments`);
      return response.data;
    } catch (error: any) {
      throw new Error(`添付ファイル取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  public async getIssueComments(issueId: number): Promise<any[]> {
    try {
      const response = await this.client.get(`/issues/${issueId}/comments`);
      return response.data;
    } catch (error: any) {
      throw new Error(`コメント取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  public async deleteAttachment(issueId: number, attachmentId: number): Promise<any> {
    try {
      const response = await this.client.delete(`/issues/${issueId}/attachments/${attachmentId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`添付ファイル削除エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  public async deleteCommentAttachment(issueId: number, commentId: number, attachmentId: number): Promise<any> {
    try {
      const response = await this.client.delete(`/issues/${issueId}/comments/${commentId}/attachments/${attachmentId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`コメント添付ファイル削除エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  public async getIssuesWithAttachments(projectId: string, issueKeyRange: { from: string; to: string; } | null | undefined = null): Promise<Issue[]> {
    try {
      let issues: Issue[] = [];
      
      if (issueKeyRange && issueKeyRange.from && issueKeyRange.to) {
        const fromNum = this.extractIssueNumber(issueKeyRange.from);
        const toNum = this.extractIssueNumber(issueKeyRange.to);
        const projectKey = issueKeyRange.from.split('-')[0];
        
        console.log(`課題範囲検索: ${projectKey}-${fromNum} から ${projectKey}-${toNum}`);
        
        for (let num = fromNum; num <= toNum; num++) {
          const issueKey = `${projectKey}-${num}`;
          const issue = await this.getIssueByKey(issueKey);
          if (issue && issue.attachments.length > 0) {
            issues.push(issue);
          }
        }
      } else {
        const allIssues = await this.getIssues(projectId);
        issues = allIssues.filter(issue => issue.attachments.length > 0);
      }
      
      return issues;
    } catch (error: any) {
      throw new Error(`課題取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  private extractIssueNumber(issueKey: string): number {
    const parts = issueKey.split('-');
    return parseInt(parts[1], 10);
  }

  public async deleteMultipleAttachments(deletions: { issueId: number; attachmentId: number; isCommentAttachment: boolean; commentId: number; }[]): Promise<any[]> {
    const results: any[] = [];
    for (const deletion of deletions) {
      const deleteOperation = async () => {
        if (deletion.isCommentAttachment) {
          return await this.deleteCommentAttachment(deletion.issueId, deletion.commentId, deletion.attachmentId);
        } else {
          return await this.deleteAttachment(deletion.issueId, deletion.attachmentId);
        }
      };
      
      try {
        const result = await this.executeWithRetry(deleteOperation);
        results.push({ success: true, result });
      } catch (error: any) {
        results.push({ success: false, error: error.message });
      }
    }
    return results;
  }

  public async testConnection(): Promise<void> {
    try {
      await this.client.get('/users/myself');
    } catch (error: any) {
      throw new Error(`接続テストエラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // 子課題を取得
  public async getChildIssues(parentIssueId: number): Promise<Issue[]> {
    try {
      const params = {
        parentIssueId: [parentIssueId],
        count: 100
      };
      
      const response = await this.client.get('/issues', { params });
      return response.data;
    } catch (error: any) {
      throw new Error(`子課題取得エラー: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // 親課題と子課題の添付ファイルを一括取得
  public async getParentAndChildIssuesWithAttachments(parentIssueKey: string): Promise<Issue[]> {
    try {
      // 親課題を取得
      const parentIssue = await this.getIssueByKey(parentIssueKey);
      if (!parentIssue) {
        throw new Error(`親課題 ${parentIssueKey} が見つかりません`);
      }

      // 子課題を取得
      const childIssues = await this.getChildIssues(parentIssue.id);
      
      // 親課題と子課題の添付ファイル情報を取得
      const allIssues = [parentIssue, ...childIssues];
      const issuesWithAttachments: Issue[] = [];

      for (const issue of allIssues) {
        try {
          // 課題本体の添付ファイルを取得
          const issueAttachments = await this.getIssueAttachments(issue.id);
          
          // コメントの添付ファイルを取得
          const comments = await this.getIssueComments(issue.id);
          const commentAttachments: CommentAttachment[] = [];
          
          for (const comment of comments as Comment[]) {
            if (comment.attachments && comment.attachments.length > 0) {
              comment.attachments.forEach(attachment => {
                commentAttachments.push({
                  ...attachment,
                  commentId: comment.id,
                  commentContent: comment.content,
                  isCommentAttachment: true
                });
              });
            }
          }
          
          // 全ての添付ファイルを結合
          const allAttachments = [
            ...issueAttachments.map(attachment => ({
              ...attachment,
              isCommentAttachment: false
            })),
            ...commentAttachments
          ];
          
          if (allAttachments.length > 0) {
            issuesWithAttachments.push({
              ...issue,
              attachments: allAttachments
            });
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.warn(`課題 ${issue.issueKey} の添付ファイル取得に失敗:`, error.message);
          }
        }
      }

      return issuesWithAttachments;
    } catch (error: any) {
      throw new Error(`親子課題の添付ファイル取得エラー: ${error.message}`);
    }
  }

  // 指定した課題キーの本文・コメントの添付ファイルをすべて削除
  public async deleteAllAttachmentsByIssueKey(issueKey: string): Promise<{success: number, failed: number}> {
    // 課題詳細取得
    const issue = await this.getIssueByKey(issueKey);
    if (!issue) throw new Error(`Issue ${issueKey} not found`);
    const issueId = issue.id;
    // 本文添付ファイル取得
    const attachments = await this.getIssueAttachments(issueId);
    // コメント添付ファイル取得
    const comments = await this.getIssueComments(issueId);
    const commentAttachments: any[] = [];
    for (const comment of comments) {
      if (comment.attachments && comment.attachments.length > 0) {
        comment.attachments.forEach((attachment: any) => {
          commentAttachments.push({
            ...attachment,
            commentId: comment.id,
            isCommentAttachment: true
          });
        });
      }
    }
    // 削除リスト作成
    const deletions = [
      ...attachments.map(a => ({
        issueId,
        attachmentId: a.id,
        isCommentAttachment: false,
        commentId: 0
      })),
      ...commentAttachments.map(a => ({
        issueId,
        attachmentId: a.id,
        isCommentAttachment: true,
        commentId: a.commentId
      }))
    ];
    if (deletions.length === 0) return { success: 0, failed: 0 };
    // 一括削除
    const results = await this.deleteMultipleAttachments(deletions);
    const success = results.filter((r: any) => r.success).length;
    const failed = results.filter((r: any) => !r.success).length;
    return { success, failed };
  }
}

export default BacklogAPI; 