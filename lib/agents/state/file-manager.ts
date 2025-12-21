/**
 * File Manager
 * Handles file state tracking and operations
 */

import { AgentStateManager } from './agent-state-manager';
import { FileState, FileOutput } from './types';

export interface FileSummary {
  path: string;
  purpose: string;
  hasRecentChanges: boolean;
  lastUpdated: Date;
}

export interface FileSearchResult {
  files: FileState[];
  totalCount: number;
}

/**
 * FileManager - Manages generated file state
 */
export class FileManager {
  private stateManager: AgentStateManager;

  constructor(stateManager: AgentStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Get all generated files
   */
  async getAllFiles(): Promise<Record<string, FileState>> {
    const state = await this.stateManager.getCachedState();
    return state?.generatedFilesMap || {};
  }

  /**
   * Get a specific file by path
   */
  async getFile(filePath: string): Promise<FileState | null> {
    const files = await this.getAllFiles();
    return files[filePath] || null;
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    const file = await this.getFile(filePath);
    return file !== null;
  }

  /**
   * Add or update a generated file
   */
  async upsertFile(file: FileOutput, diff?: string): Promise<FileState> {
    const now = new Date();
    const existingFile = await this.getFile(file.filePath);

    const fileState: FileState = {
      ...file,
      lastDiff: diff || '',
      generatedAt: existingFile?.generatedAt || now,
      updatedAt: now,
    };

    await this.stateManager.updateGeneratedFile(fileState);
    return fileState;
  }

  /**
   * Update file contents
   */
  async updateFileContents(
    filePath: string,
    contents: string,
    diff?: string
  ): Promise<FileState | null> {
    const existingFile = await this.getFile(filePath);
    if (!existingFile) return null;

    const updatedFile: FileState = {
      ...existingFile,
      fileContents: contents,
      lastDiff: diff || existingFile.lastDiff,
      updatedAt: new Date(),
    };

    await this.stateManager.updateGeneratedFile(updatedFile);
    return updatedFile;
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<boolean> {
    const state = await this.stateManager.getCachedState();
    if (!state) return false;

    const files = { ...state.generatedFilesMap };
    if (!files[filePath]) return false;

    delete files[filePath];
    await this.stateManager.setField('generatedFilesMap', files);
    return true;
  }

  /**
   * Get file summaries for AI context
   */
  async getFileSummaries(maxFiles = 120): Promise<string> {
    const files = await this.getAllFiles();
    const fileList = Object.values(files);

    const summaries = fileList
      .slice(0, maxFiles)
      .map(f => {
        const purpose = f.filePurpose ? ` — ${f.filePurpose}` : '';
        return `- ${f.filePath}${purpose}`;
      })
      .join('\n');

    const extra = fileList.length > maxFiles
      ? `\n...and ${fileList.length - maxFiles} more`
      : '';

    return summaries + extra;
  }

  /**
   * Get files by extension
   */
  async getFilesByExtension(extension: string): Promise<FileState[]> {
    const files = await this.getAllFiles();
    return Object.values(files).filter(f =>
      f.filePath.endsWith(extension)
    );
  }

  /**
   * Get files in a directory
   */
  async getFilesInDirectory(directory: string): Promise<FileState[]> {
    const files = await this.getAllFiles();
    const normalizedDir = directory.endsWith('/') ? directory : `${directory}/`;

    return Object.values(files).filter(f =>
      f.filePath.startsWith(normalizedDir)
    );
  }

  /**
   * Search files by purpose
   */
  async searchByPurpose(query: string): Promise<FileState[]> {
    const files = await this.getAllFiles();
    const lowerQuery = query.toLowerCase();

    return Object.values(files).filter(f =>
      f.filePurpose.toLowerCase().includes(lowerQuery) ||
      f.filePath.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get recently modified files
   */
  async getRecentlyModified(limit = 10): Promise<FileState[]> {
    const files = await this.getAllFiles();
    
    return Object.values(files)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get file count
   */
  async getFileCount(): Promise<number> {
    const files = await this.getAllFiles();
    return Object.keys(files).length;
  }

  /**
   * Get total content size
   */
  async getTotalContentSize(): Promise<number> {
    const files = await this.getAllFiles();
    return Object.values(files).reduce(
      (total, file) => total + file.fileContents.length,
      0
    );
  }

  /**
   * Batch update multiple files
   */
  async batchUpdate(files: FileOutput[]): Promise<FileState[]> {
    const results: FileState[] = [];
    
    for (const file of files) {
      const result = await this.upsertFile(file);
      results.push(result);
    }

    return results;
  }

  /**
   * Get files with diffs (recently changed)
   */
  async getFilesWithDiffs(): Promise<FileState[]> {
    const files = await this.getAllFiles();
    return Object.values(files).filter(f => f.lastDiff && f.lastDiff.length > 0);
  }

  /**
   * Clear all diffs
   */
  async clearDiffs(): Promise<void> {
    const state = await this.stateManager.getCachedState();
    if (!state) return;

    const files = { ...state.generatedFilesMap };
    for (const path of Object.keys(files)) {
      files[path] = { ...files[path], lastDiff: '' };
    }

    await this.stateManager.setField('generatedFilesMap', files);
  }

  /**
   * Export files as a flat array
   */
  async exportFiles(): Promise<FileOutput[]> {
    const files = await this.getAllFiles();
    return Object.values(files).map(f => ({
      filePath: f.filePath,
      fileContents: f.fileContents,
      filePurpose: f.filePurpose,
    }));
  }
}

export default FileManager;





