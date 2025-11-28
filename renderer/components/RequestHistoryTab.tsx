import React from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Request } from '../types/dashboard'
import { formatDate, getStatusBadge } from '../utils/dashboard'

interface RequestHistoryTabProps {
    requests: Request[]
}

export const RequestHistoryTab: React.FC<RequestHistoryTabProps> = ({ requests }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>All Request History</CardTitle>
                <CardDescription>
                    Complete history of all requests
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {requests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No request history available
                        </div>
                    ) : (
                        requests.map((request) => (
                            <div
                                key={request.id}
                                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900">
                                            {request.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {request.description}
                                        </p>
                                        <div className="flex items-center space-x-4 mt-2">
                                            <p className="text-xs text-gray-500">
                                                Created {formatDate(request.createdAt)}
                                            </p>
                                            {request.updatedAt !== request.createdAt && (
                                                <p className="text-xs text-gray-500">
                                                    Updated {formatDate(request.updatedAt)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="ml-4">
                                        {getStatusBadge(request.status)}
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <Button size="sm" variant="outline">
                                        View Details
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

