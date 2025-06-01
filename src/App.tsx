import React, { useState, useEffect } from 'react';
import BacklogAPI from './services/backlogApi';
import {
  Box, Stack, Heading, Input, Button, Select, Alert, AlertIcon, Spinner, Tabs, TabList, TabPanels, TabPanel, Tab, Text, Flex, useColorModeValue
} from '@chakra-ui/react';

interface Config {
  spaceUrl: string;
  apiKey: string;
  projectId: string;
  issueKeyRange?: {
    from: string;
    to: string;
  };
  searchMode: 'parent' | 'range';
}

interface Attachment {
  key: string;
  issueId: number;
  attachmentId: number;
  issueKey: string;
  fileName: string;
  isCommentAttachment: boolean;
  commentId: number;
}

interface Stats {
  totalIssues: number;
  totalAttachments: number;
  totalSize: number;
}

interface Issue {
  id: number;
  issueKey: string;
  summary: string;
  attachments: Array<{
    id: number;
    name: string;
    size?: number;
    isCommentAttachment: boolean;
    commentId?: number;
    commentContent?: string;
  }>;
}

function App() {
  // Load config and parentIssueKey from localStorage
  const loadConfigFromStorage = () => {
    try {
      const savedConfig = localStorage.getItem('backlog-tool-config');
      if (savedConfig) {
        return JSON.parse(savedConfig);
      }
    } catch (error) {
      // ignore
    }
    return {
      spaceUrl: '',
      apiKey: '',
      projectId: '',
      issueKeyRange: { from: '', to: '' },
      searchMode: 'parent'
    };
  };
  const loadParentIssueKeyFromStorage = () => {
    try {
      const saved = localStorage.getItem('backlog-tool-parent-issue-key');
      if (saved) return saved;
    } catch (error) {}
    return '';
  };

  const [config, setConfig] = useState<Config>(loadConfigFromStorage);
  const [projects, setProjects] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [backlogApi, setBacklogApi] = useState<BacklogAPI | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<Attachment[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalIssues: 0,
    totalAttachments: 0,
    totalSize: 0
  });
  const [parentIssueKey, setParentIssueKey] = useState(loadParentIssueKeyFromStorage);
  const [singleDeleteKey, setSingleDeleteKey] = useState('');
  const [singleDeleteLoading, setSingleDeleteLoading] = useState(false);
  const [singleDeleteResult, setSingleDeleteResult] = useState<{success: number, failed: number} | null>(null);

  // Save config and parentIssueKey to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('backlog-tool-config', JSON.stringify(config));
    } catch (error) {}
  }, [config]);
  useEffect(() => {
    try {
      localStorage.setItem('backlog-tool-parent-issue-key', parentIssueKey);
    } catch (error) {}
  }, [parentIssueKey]);

  const handleConfigChange = (key: keyof Config, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const testConnection = async () => {
    if (!config.spaceUrl || !config.apiKey) {
      setError('Please enter Space URL and API Key');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const api = new BacklogAPI(config.spaceUrl, config.apiKey);
      await api.testConnection();
      setBacklogApi(api);
      
      const projectList = await api.getProjects();
      setProjects(projectList);
      setSuccess('Connection successful');
    } catch (err: any) {
      setError(err.message);
      setBacklogApi(null);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const searchIssuesWithAttachments = async () => {
    if (!backlogApi || !config.projectId) {
      setError('Please select a project');
      return;
    }

    setLoading(true);
    setError('');
    setIssues([]);
    setSelectedAttachments([]);
    
    try {
      const issueKeyRange = config.issueKeyRange ? {
        from: config.issueKeyRange.from.trim(),
        to: config.issueKeyRange.to.trim()
      } : null;

      const issuesWithAttachments = await backlogApi.getIssuesWithAttachments(
        config.projectId,
        issueKeyRange
      );
      
      setIssues(issuesWithAttachments);
      
      const totalAttachments = issuesWithAttachments.reduce(
        (sum: number, issue: any) => sum + issue.attachments.length, 0
      );
      const totalSize = issuesWithAttachments.reduce(
        (sum: number, issue: any) => sum + issue.attachments.reduce(
          (attachSum: number, attach: any) => attachSum + (attach.size || 0), 0
        ), 0
      );
      
      setStats({
        totalIssues: issuesWithAttachments.length,
        totalAttachments,
        totalSize
      });
      
      setSuccess(`Found ${issuesWithAttachments.length} issues with attachments`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttachmentSelection = (issueId: number, attachmentId: number, issueKey: string, fileName: string, attachment: Issue['attachments'][0]) => {
    const key = `${issueId}-${attachmentId}`;
    
    setSelectedAttachments(prev => {
      const exists = prev.find(item => item.key === key);
      
      if (exists) {
        return prev.filter(item => item.key !== key);
      } else {
        return [...prev, {
          key,
          issueId,
          attachmentId,
          issueKey,
          fileName,
          isCommentAttachment: attachment.isCommentAttachment,
          commentId: attachment.commentId || 0
        }];
      }
    });
  };

  const toggleAllAttachments = () => {
    if (selectedAttachments.length === 0) {
      const allAttachments: Attachment[] = [];
      issues.forEach(issue => {
        issue.attachments.forEach((attachment: Issue['attachments'][0]) => {
          allAttachments.push({
            key: `${issue.id}-${attachment.id}`,
            issueId: issue.id,
            attachmentId: attachment.id,
            issueKey: issue.issueKey,
            fileName: attachment.name,
            isCommentAttachment: attachment.isCommentAttachment,
            commentId: attachment.commentId || 0
          });
        });
      });
      setSelectedAttachments(allAttachments);
    } else {
      setSelectedAttachments([]);
    }
  };

  const deleteSelectedAttachments = async () => {
    if (selectedAttachments.length === 0) {
      setError('Please select attachments to delete');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedAttachments.length} attachments? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (!backlogApi) {
        setError('API is not initialized');
        return;
      }
      const results = await backlogApi.deleteMultipleAttachments(selectedAttachments);
      const successCount = results.filter((r: any) => r.success).length;
      const failureCount = results.filter((r: any) => !r.success).length;
      setSuccess(`Delete completed. Success: ${successCount}, Failed: ${failureCount}`);
      setIssues([]);
      setSelectedAttachments([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchParentAndChildIssues = async () => {
    if (!parentIssueKey) {
      setError('Please enter the parent issue key');
      return;
    }

    if (!backlogApi) {
      setError('API is not initialized. Please test the connection.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setIssues([]);
    setSelectedAttachments([]);

    try {
      const issues = await backlogApi.getParentAndChildIssuesWithAttachments(parentIssueKey);
      setIssues(issues);
      // Update statistics
      const totalAttachments = issues.reduce(
        (sum: number, issue: any) => sum + issue.attachments.length, 0
      );
      const totalSize = issues.reduce(
        (sum: number, issue: any) => sum + issue.attachments.reduce(
          (attachSum: number, attach: any) => attachSum + (attach.size || 0), 0
        ), 0
      );
      setStats({
        totalIssues: issues.length,
        totalAttachments,
        totalSize
      });
      if (issues.length === 0) {
        setSuccess('No attachments found.');
      } else {
        setSuccess(`Found attachments in ${issues.length} issues.`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingleIssueAttachments = async () => {
    if (!singleDeleteKey) {
      setError('Please enter an issue key');
      return;
    }
    if (!backlogApi) {
      setError('API is not initialized');
      return;
    }
    setSingleDeleteLoading(true);
    setError('');
    setSuccess('');
    setSingleDeleteResult(null);
    try {
      const result = await backlogApi.deleteAllAttachmentsByIssueKey(singleDeleteKey.trim());
      setSingleDeleteResult(result);
      setSuccess(`Delete completed for ${singleDeleteKey}. Success: ${result.success}, Failed: ${result.failed}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSingleDeleteLoading(false);
    }
  };

  return (
    <Box maxW="900px" mx="auto" p={6} bg={useColorModeValue('white', 'gray.800')} borderRadius="lg" boxShadow="md">
      <Heading as="h1" size="lg" mb={6}>Backlog Attachment Cleaner</Heading>
      {/* Configuration Form */}
      <Box mb={8} p={6} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md" boxShadow="sm">
        <Heading as="h2" size="md" mb={4}>Settings</Heading>
        <Stack spacing={4}>
          <Box>
            <Text mb={1}>Space URL:</Text>
            <Input
              value={config.spaceUrl}
              onChange={e => handleConfigChange('spaceUrl', e.target.value)}
              placeholder="https://your-space.backlog.com"
            />
          </Box>
          <Box>
            <Text mb={1}>API Key:</Text>
            <Input
              type="password"
              value={config.apiKey}
              onChange={e => handleConfigChange('apiKey', e.target.value)}
              placeholder="Your API Key"
            />
          </Box>
          <Button
            colorScheme="blue"
            onClick={testConnection}
            isDisabled={loading || !config.spaceUrl || !config.apiKey}
            mb={2}
          >
            {loading ? <Spinner size="sm" mr={2} /> : null}
            {loading ? 'Testing connection...' : 'Test Connection'}
          </Button>
          {projects.length > 0 && (
            <Box>
              <Text mb={1}>Project:</Text>
              <Select
                value={config.projectId}
                onChange={e => handleConfigChange('projectId', e.target.value)}
                placeholder="Select a project"
              >
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.projectKey})
                  </option>
                ))}
              </Select>
            </Box>
          )}
        </Stack>
      </Box>
      {/* Search Options */}
      <Box mb={8} p={6} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md" boxShadow="sm">
        <Heading as="h2" size="md" mb={4}>Search Options</Heading>
        <Tabs variant="enclosed" colorScheme="blue" index={config.searchMode === 'parent' ? 0 : 1} onChange={i => handleConfigChange('searchMode', i === 0 ? 'parent' : 'range')}>
          <TabList>
            <Tab>Search by Parent Issue</Tab>
            <Tab>Search by Issue Range</Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={0}>
              <Stack spacing={3}>
                <Box>
                  <Text mb={1}>Parent Issue Key:</Text>
                  <Flex>
                    <Input
                      value={parentIssueKey}
                      onChange={e => setParentIssueKey(e.target.value)}
                      placeholder="PROJECT-123"
                      mr={2}
                    />
                    <Button
                      colorScheme="blue"
                      onClick={searchParentAndChildIssues}
                      isDisabled={loading || !parentIssueKey}
                    >
                      {loading ? <Spinner size="sm" mr={2} /> : null}
                      {loading ? 'Searching...' : 'Search'}
                    </Button>
                  </Flex>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Enter the parent issue key (e.g., PROJECT-123). Attachments for the parent and its child issues will be displayed.
                  </Text>
                </Box>
              </Stack>
            </TabPanel>
            <TabPanel px={0}>
              <Stack spacing={3}>
                <Box>
                  <Text mb={1}>Issue Key Range:</Text>
                  <Flex align="center">
                    <Input
                      value={config.issueKeyRange?.from || ''}
                      onChange={e => handleConfigChange('issueKeyRange', { ...config.issueKeyRange, from: e.target.value })}
                      placeholder="PROJECT-123"
                      mr={2}
                    />
                    <Text mx={2}>to</Text>
                    <Input
                      value={config.issueKeyRange?.to || ''}
                      onChange={e => handleConfigChange('issueKeyRange', { ...config.issueKeyRange, to: e.target.value })}
                      placeholder="PROJECT-456"
                      mr={2}
                    />
                    <Button
                      colorScheme="blue"
                      onClick={searchIssuesWithAttachments}
                      isDisabled={loading || !config.issueKeyRange?.from || !config.issueKeyRange?.to}
                    >
                      {loading ? <Spinner size="sm" mr={2} /> : null}
                      {loading ? 'Searching...' : 'Search'}
                    </Button>
                  </Flex>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Specify the range of issue keys to search. Attachments for issues within the specified range will be displayed.
                  </Text>
                </Box>
              </Stack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
      {/* Single Issue Delete Section */}
      <Box mb={8} p={6} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md" boxShadow="sm">
        <Heading as="h2" size="md" mb={4}>Delete Attachments by Issue Key</Heading>
        <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align="center">
          <Input
            value={singleDeleteKey}
            onChange={e => setSingleDeleteKey(e.target.value)}
            placeholder="PROJECT-123"
            maxW="300px"
          />
          <Button
            colorScheme="red"
            onClick={handleDeleteSingleIssueAttachments}
            isLoading={singleDeleteLoading}
            disabled={singleDeleteLoading || !singleDeleteKey}
          >
            Delete Attachments
          </Button>
        </Stack>
        {singleDeleteResult && (
          <Alert status="success" mt={4} borderRadius="md">
            <AlertIcon />
            Success: {singleDeleteResult.success}, Failed: {singleDeleteResult.failed}
          </Alert>
        )}
      </Box>
      {/* Error and Success Messages */}
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      )}
      {success && (
        <Alert status="success" mb={4} borderRadius="md">
          <AlertIcon />
          {success}
        </Alert>
      )}
      {/* Results Section */}
      {issues.length > 0 && (
        <Box className="results-section" mb={8} p={6} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md" boxShadow="sm">
          <Flex className="stats" gap={8} mb={6} p={3} bg={useColorModeValue('gray.100', 'gray.600')} borderRadius="md">
            <Box>Total Issues: {stats.totalIssues}</Box>
            <Box>Total Attachments: {stats.totalAttachments}</Box>
            <Box>Total File Size: {formatFileSize(stats.totalSize)}</Box>
          </Flex>
          <Flex className="actions" gap={4} mb={4}>
            <Button
              colorScheme="blue"
              onClick={toggleAllAttachments}
              isDisabled={loading}
            >
              {selectedAttachments.length === 0 ? 'Select All' : 'Deselect All'}
            </Button>
            <Button
              colorScheme="red"
              onClick={deleteSelectedAttachments}
              isDisabled={loading || selectedAttachments.length === 0}
            >
              {loading ? <Spinner size="sm" mr={2} /> : null}
              {loading ? 'Deleting...' : `Delete Selected Files (${selectedAttachments.length})`}
            </Button>
          </Flex>
          <Stack spacing={4} className="issues-list">
            {issues.map(issue => (
              <Box key={issue.id} className="issue-card" p={4} borderWidth={1} borderRadius="md" bg={useColorModeValue('white', 'gray.800')}>
                <Flex className="issue-header" mb={3} align="center" justify="space-between">
                  <Heading as="h3" size="sm">{issue.issueKey}</Heading>
                  <Text className="issue-summary" color="gray.600">{issue.summary}</Text>
                </Flex>
                <Stack className="attachments-list" spacing={2}>
                  {issue.attachments.map((attachment: Issue['attachments'][0]) => {
                    const isSelected = selectedAttachments.some(
                      item => item.key === `${issue.id}-${attachment.id}`
                    );
                    return (
                      <Flex key={attachment.id} className="attachment-item" align="center" justify="space-between" p={2} borderBottomWidth={1} borderColor="gray.100">
                        <Box className="attachment-info">
                          <Text className="attachment-name" fontWeight="medium">
                            {attachment.name}
                            {attachment.isCommentAttachment && (
                              <Text as="span" className="comment-badge" ml={2} fontSize="xs" bg="gray.200" borderRadius="md" px={2} py={1} color="gray.600">Comment Attachment</Text>
                            )}
                          </Text>
                          <Text className="attachment-size" color="gray.500" fontSize="sm">
                            {formatFileSize(attachment.size || 0)}
                          </Text>
                        </Box>
                        <Flex align="center" gap={2}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAttachmentSelection(
                              issue.id,
                              attachment.id,
                              issue.issueKey,
                              attachment.name,
                              attachment
                            )}
                          />
                          <Text as="span">Select</Text>
                        </Flex>
                      </Flex>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
      {/* Loading Indicator */}
      {loading && (
        <Flex className="loading-overlay" direction="column" align="center" justify="center" position="fixed" top={0} left={0} right={0} bottom={0} bg="rgba(255,255,255,0.8)" zIndex={1000}>
          <Spinner size="xl" color="blue.500" />
          <Text mt={4} color="gray.600">Processing...</Text>
        </Flex>
      )}
    </Box>
  );
}

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export default App; 