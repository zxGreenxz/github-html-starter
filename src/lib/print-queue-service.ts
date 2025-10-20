import { NetworkPrinter, printHTMLToXC80 } from './printer-config-utils';

export type PrintJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type PrintJobPriority = 'normal' | 'high';

export interface PrintJob {
  id: string;
  printer: NetworkPrinter;
  html: string;
  settings: {
    width: number;
    height: number | null;
    threshold: number;
    scale: number;
  };
  priority: PrintJobPriority;
  status: PrintJobStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  processedAt?: number;
  error?: string;
  callbacks?: {
    onSuccess?: (job: PrintJob) => void;
    onError?: (job: PrintJob, error: string) => void;
  };
  metadata?: {
    sessionIndex?: string;
    customerName?: string;
    productCode?: string;
  };
}

export type QueueEventType = 
  | 'job-added'
  | 'job-started'
  | 'job-completed'
  | 'job-failed'
  | 'queue-paused'
  | 'queue-resumed'
  | 'queue-cleared';

export interface QueueEvent {
  type: QueueEventType;
  job?: PrintJob;
  timestamp: number;
}

type QueueListener = (event: QueueEvent) => void;

class PrintQueueService {
  private static instance: PrintQueueService | null = null;
  private queue: PrintJob[] = [];
  private isProcessing = false;
  private isPaused = false;
  private listeners: QueueListener[] = [];
  private processingJob: PrintJob | null = null;
  
  // Configuration
  private readonly DELAY_BETWEEN_JOBS = 500; // ms
  private readonly MAX_RETRIES = 3;
  private readonly STORAGE_KEY = 'print-queue-state';

  private constructor() {
    // Load persisted queue from localStorage
    this.loadFromStorage();
  }

  static getInstance(): PrintQueueService {
    if (!PrintQueueService.instance) {
      PrintQueueService.instance = new PrintQueueService();
    }
    return PrintQueueService.instance;
  }

  // Event system
  subscribe(listener: QueueListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: QueueEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  // Add job to queue
  addJob(
    jobData: Omit<PrintJob, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt'>
  ): string {
    const job: PrintJob = {
      ...jobData,
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      createdAt: Date.now(),
    };

    // Insert based on priority (high priority goes first)
    if (job.priority === 'high') {
      const firstNormalIndex = this.queue.findIndex(j => j.priority === 'normal');
      if (firstNormalIndex === -1) {
        this.queue.push(job);
      } else {
        this.queue.splice(firstNormalIndex, 0, job);
      }
    } else {
      this.queue.push(job);
    }

    this.emit({ type: 'job-added', job, timestamp: Date.now() });
    this.saveToStorage();
    
    // Start processing if not already processing
    if (!this.isProcessing && !this.isPaused) {
      this.processQueue();
    }

    return job.id;
  }

  // Process queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 && !this.isPaused) {
      const job = this.queue[0];
      this.processingJob = job;
      job.status = 'processing';
      
      this.emit({ type: 'job-started', job, timestamp: Date.now() });
      this.saveToStorage();

      try {
        const result = await printHTMLToXC80(job.printer, job.html, job.settings);
        
        if (result.success) {
          // Success
          job.status = 'completed';
          job.processedAt = Date.now();
          this.queue.shift(); // Remove from queue
          
          this.emit({ type: 'job-completed', job, timestamp: Date.now() });
          
          if (job.callbacks?.onSuccess) {
            job.callbacks.onSuccess(job);
          }
        } else {
          // Failed - retry or mark as failed
          job.retryCount++;
          
          if (job.retryCount >= job.maxRetries) {
            job.status = 'failed';
            job.error = result.error || 'Unknown error';
            job.processedAt = Date.now();
            this.queue.shift(); // Remove from queue
            
            this.emit({ type: 'job-failed', job, timestamp: Date.now() });
            
            if (job.callbacks?.onError) {
              job.callbacks.onError(job, job.error);
            }
          } else {
            // Retry - move to back of same priority group
            job.status = 'pending';
            this.queue.shift();
            
            if (job.priority === 'high') {
              const lastHighIndex = this.queue.findIndex(j => j.priority === 'normal');
              if (lastHighIndex === -1) {
                this.queue.push(job);
              } else {
                this.queue.splice(lastHighIndex, 0, job);
              }
            } else {
              this.queue.push(job);
            }
          }
        }
      } catch (error: any) {
        job.retryCount++;
        
        if (job.retryCount >= job.maxRetries) {
          job.status = 'failed';
          job.error = error.message || 'Exception occurred';
          job.processedAt = Date.now();
          this.queue.shift();
          
          this.emit({ type: 'job-failed', job, timestamp: Date.now() });
          
          if (job.callbacks?.onError) {
            job.callbacks.onError(job, job.error);
          }
        } else {
          job.status = 'pending';
          this.queue.shift();
          this.queue.push(job);
        }
      }

      this.saveToStorage();
      
      // Delay between jobs
      if (this.queue.length > 0 && !this.isPaused) {
        await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_JOBS));
      }
    }

    this.processingJob = null;
    this.isProcessing = false;
  }

  // Queue control
  pauseQueue(): void {
    this.isPaused = true;
    this.emit({ type: 'queue-paused', timestamp: Date.now() });
    this.saveToStorage();
  }

  resumeQueue(): void {
    this.isPaused = false;
    this.emit({ type: 'queue-resumed', timestamp: Date.now() });
    this.saveToStorage();
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  clearQueue(): void {
    this.queue = [];
    this.emit({ type: 'queue-cleared', timestamp: Date.now() });
    this.saveToStorage();
  }

  retryFailedJob(jobId: string): boolean {
    const jobIndex = this.queue.findIndex(j => j.id === jobId && j.status === 'failed');
    if (jobIndex === -1) return false;

    const job = this.queue[jobIndex];
    job.status = 'pending';
    job.retryCount = 0;
    job.error = undefined;

    this.emit({ type: 'job-added', job, timestamp: Date.now() });
    this.saveToStorage();

    if (!this.isProcessing && !this.isPaused) {
      this.processQueue();
    }

    return true;
  }

  removeJob(jobId: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(j => j.id !== jobId);
    const removed = this.queue.length < initialLength;
    
    if (removed) {
      this.saveToStorage();
    }
    
    return removed;
  }

  // Queue status
  getQueueStatus() {
    const pending = this.queue.filter(j => j.status === 'pending').length;
    const processing = this.queue.filter(j => j.status === 'processing').length;
    const failed = this.queue.filter(j => j.status === 'failed').length;
    
    return {
      total: this.queue.length,
      pending,
      processing,
      failed,
      isPaused: this.isPaused,
      isProcessing: this.isProcessing,
      processingJob: this.processingJob,
      queue: [...this.queue],
    };
  }

  getJob(jobId: string): PrintJob | undefined {
    return this.queue.find(j => j.id === jobId);
  }

  // Persistence
  private saveToStorage(): void {
    try {
      const state = {
        queue: this.queue.map(job => ({
          ...job,
          callbacks: undefined, // Don't persist callbacks
        })),
        isPaused: this.isPaused,
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        this.queue = state.queue || [];
        this.isPaused = state.isPaused || false;
        
        // Resume processing if there are pending jobs
        if (this.queue.length > 0 && !this.isPaused) {
          this.processQueue();
        }
      }
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
    }
  }
}

export default PrintQueueService;
