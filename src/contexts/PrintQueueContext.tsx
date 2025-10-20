import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import PrintQueueService, { PrintJob, QueueEvent } from '@/lib/print-queue-service';

interface PrintQueueContextType {
  addJob: (jobData: Omit<PrintJob, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt'>) => string;
  pauseQueue: () => void;
  resumeQueue: () => void;
  clearQueue: () => void;
  retryFailedJob: (jobId: string) => boolean;
  removeJob: (jobId: string) => boolean;
  getJob: (jobId: string) => PrintJob | undefined;
  queueStatus: {
    total: number;
    pending: number;
    processing: number;
    failed: number;
    isPaused: boolean;
    isProcessing: boolean;
    processingJob: PrintJob | null;
    queue: PrintJob[];
  };
}

const PrintQueueContext = createContext<PrintQueueContextType | null>(null);

export const usePrintQueue = () => {
  const context = useContext(PrintQueueContext);
  if (!context) {
    throw new Error('usePrintQueue must be used within PrintQueueProvider');
  }
  return context;
};

interface PrintQueueProviderProps {
  children: React.ReactNode;
}

export const PrintQueueProvider: React.FC<PrintQueueProviderProps> = ({ children }) => {
  const [queueService] = useState(() => PrintQueueService.getInstance());
  const [queueStatus, setQueueStatus] = useState(() => queueService.getQueueStatus());

  const updateStatus = useCallback(() => {
    setQueueStatus(queueService.getQueueStatus());
  }, [queueService]);

  useEffect(() => {
    // Subscribe to queue events
    const unsubscribe = queueService.subscribe((event: QueueEvent) => {
      updateStatus();
    });

    // Initial status update
    updateStatus();

    return unsubscribe;
  }, [queueService, updateStatus]);

  const addJob = useCallback((jobData: Omit<PrintJob, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt'>) => {
    return queueService.addJob(jobData);
  }, [queueService]);

  const pauseQueue = useCallback(() => {
    queueService.pauseQueue();
  }, [queueService]);

  const resumeQueue = useCallback(() => {
    queueService.resumeQueue();
  }, [queueService]);

  const clearQueue = useCallback(() => {
    queueService.clearQueue();
  }, [queueService]);

  const retryFailedJob = useCallback((jobId: string) => {
    return queueService.retryFailedJob(jobId);
  }, [queueService]);

  const removeJob = useCallback((jobId: string) => {
    return queueService.removeJob(jobId);
  }, [queueService]);

  const getJob = useCallback((jobId: string) => {
    return queueService.getJob(jobId);
  }, [queueService]);

  const value: PrintQueueContextType = {
    addJob,
    pauseQueue,
    resumeQueue,
    clearQueue,
    retryFailedJob,
    removeJob,
    getJob,
    queueStatus,
  };

  return (
    <PrintQueueContext.Provider value={value}>
      {children}
    </PrintQueueContext.Provider>
  );
};
