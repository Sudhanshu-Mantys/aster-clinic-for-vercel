import React from 'react';
import { Modal } from './ui/modal';

export interface StatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'success' | 'error' | 'partial';
  title?: string;
  message?: string;
  reqId?: string | null;
  documentCount?: number;
  failedCount?: number;
  errorDetails?: string;
}

export const StatusDialog: React.FC<StatusDialogProps> = ({
  isOpen,
  onClose,
  status,
  title,
  message,
  reqId,
  documentCount,
  failedCount,
  errorDetails,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'partial':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return (
          <svg className="w-12 h-12 text-green-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-12 h-12 text-red-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'partial':
        return (
          <svg className="w-12 h-12 text-yellow-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
    }
  };

  const getDefaultTitle = () => {
    switch (status) {
      case 'success':
        return 'Success!';
      case 'error':
        return 'Error';
      case 'partial':
        return 'Partially Completed';
      default:
        return 'Status';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
      <div className={`p-8 ${getStatusColor()} border-t-4 rounded-b-lg`}>
        <div className="text-center">
          {getStatusIcon()}

          <h2 className="text-2xl font-bold mt-4 mb-2 text-gray-900">
            {title || getDefaultTitle()}
          </h2>

          {message && (
            <p className="text-gray-700 text-base mb-4">
              {message}
            </p>
          )}

          {reqId && (
            <div className="bg-white bg-opacity-70 rounded-lg p-4 mb-4 border border-gray-300">
              <p className="text-sm font-semibold text-gray-600 mb-1">Request ID</p>
              <p className="text-lg font-mono text-gray-900">{reqId}</p>
            </div>
          )}

          {documentCount !== undefined && (
            <div className="bg-white bg-opacity-70 rounded-lg p-4 mb-4 border border-gray-300">
              {status === 'success' ? (
                <p className="text-base text-gray-900">
                  All <span className="font-bold">{documentCount}</span> documents uploaded successfully!
                </p>
              ) : status === 'partial' ? (
                <div className="space-y-2">
                  <p className="text-base text-gray-900">
                    Uploaded: <span className="font-bold text-green-600">{documentCount - (failedCount || 0)}</span>
                  </p>
                  <p className="text-base text-gray-900">
                    Failed: <span className="font-bold text-red-600">{failedCount}</span>
                  </p>
                </div>
              ) : (
                <p className="text-base text-gray-900">
                  {documentCount} {documentCount === 1 ? 'document' : 'documents'}
                </p>
              )}
            </div>
          )}

          {errorDetails && (
            <div className="bg-white bg-opacity-70 rounded-lg p-4 mb-4 border border-red-300 text-left">
              <p className="text-sm font-semibold text-red-600 mb-2">Error Details:</p>
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto">
                {errorDetails}
              </pre>
            </div>
          )}

          <button
            onClick={onClose}
            className={`mt-4 px-8 py-3 rounded-lg font-semibold text-white transition-colors ${
              status === 'success'
                ? 'bg-green-600 hover:bg-green-700'
                : status === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default StatusDialog;
