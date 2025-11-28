import React from 'react'
import { Badge } from '../components/ui/badge'

// Date formatting utility
export const formatDate = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    }
}

// Status badge rendering utility
export const getStatusBadge = (status: string) => {
    const label = status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

    switch (status) {
        case 'pending':
            return React.createElement(Badge, { className: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100" }, label)
        case 'in-progress':
            return React.createElement(Badge, { className: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100" }, label)
        case 'completed':
            return React.createElement(Badge, { className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" }, label)
        default:
            return React.createElement(Badge, { variant: "outline" }, label)
    }
}

