import React from 'react'
import { Modal } from './ui/modal'

interface ExtractionProgressModalProps {
  isOpen: boolean
  onClose: () => void
  status: 'idle' | 'pending' | 'processing' | 'complete'
  statusMessage: string
  interimScreenshot: string | null
  interimDocuments: Array<{ id: string; tag: string; url: string }>
  pollingAttempts: number
  maxAttempts: number
}

export const ExtractionProgressModal: React.FC<ExtractionProgressModalProps> = ({
  isOpen,
  onClose,
  status,
  statusMessage,
  interimScreenshot,
  interimDocuments,
  pollingAttempts,
  maxAttempts
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600'
      case 'processing':
        return 'text-blue-600'
      case 'complete':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const getProgressPercentage = () => {
    if (status === 'complete') return 100
    if (status === 'processing' && pollingAttempts > 0) {
      // Estimate progress based on attempts (slower growth as it approaches 100%)
      const rawProgress = (pollingAttempts / maxAttempts) * 100
      return Math.min(rawProgress * 0.8, 95) // Cap at 95% until complete
    }
    return 10 // Show some progress when pending
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Insurance Eligibility Check in Progress"
      showCloseButton={status === 'complete'}
    >
      <div className="p-6">
        {/* Status Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            {status !== 'complete' && (
              <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {status === 'complete' && (
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <h3 className={`text-lg font-semibold ${getStatusColor()}`}>
              {statusMessage}
            </h3>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>

          {/* Attempt Counter */}
          {pollingAttempts > 0 && status !== 'complete' && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Checking status... (Attempt {pollingAttempts}/{maxAttempts})</span>
              <span>Max time: 5 minutes</span>
            </div>
          )}
        </div>

        {/* Live Screenshot Display */}
        {interimScreenshot && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
              <h4 className="text-sm font-semibold text-gray-700">
                Live View: Extracting Data from TPA Portal
              </h4>
            </div>
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-md">
              <img
                src={interimScreenshot}
                alt="TPA Portal Extraction in Progress"
                className="w-full h-auto"
                onError={(e) => {
                  console.error('Failed to load screenshot:', interimScreenshot)
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 italic">
              Real-time screenshot of the automated extraction process
            </p>
          </div>
        )}

        {/* Interim Documents Display */}
        {interimDocuments && interimDocuments.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Documents Being Processed ({interimDocuments.length})
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {interimDocuments.map((doc, index) => (
                <div
                  key={doc.id || index}
                  className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{doc.tag || 'Document'}</p>
                    <p className="text-xs text-gray-500">ID: {doc.id}</p>
                  </div>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing Info */}
        {status === 'processing' && !interimScreenshot && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">What's Happening?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Connecting to insurance provider portal</li>
                  <li>• Authenticating and navigating to eligibility section</li>
                  <li>• Extracting coverage details and benefits</li>
                  <li>• Processing and validating the information</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Pending Info */}
        {status === 'pending' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-yellow-900 mb-1">Task Queued</h4>
                <p className="text-sm text-yellow-800">
                  Your eligibility check is in the queue and will begin processing shortly.
                  This typically takes 30-90 seconds.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Complete Status */}
        {status === 'complete' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-green-900 mb-1">Eligibility Check Complete!</h4>
                <p className="text-sm text-green-800">
                  Successfully retrieved eligibility information from the insurance provider.
                  You can now review the results.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ExtractionProgressModal
