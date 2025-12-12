import React, { useEffect } from 'react'
import { Button } from './button'

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    width?: string
}

export const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onClose,
    title,
    children,
    width = "600px"
}) => {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            // Prevent body scroll when sidebar is open
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div
                className={`fixed inset-y-0 right-0 bg-white shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col min-w-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{ 
                    width: width, 
                    maxWidth: `min(100vw, ${width})`,
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">
                        {title || 'Sidebar'}
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-8 w-8 p-0 hover:bg-gray-200"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                    {children}
                </div>
            </div>
        </>
    )
}

