// Dashboard related types and interfaces

export interface Request {
    id: string
    title: string
    description: string
    status: 'pending' | 'in-progress' | 'completed'
    createdAt: Date
    updatedAt: Date
}

export type SearchType = 'mpi' | 'patientId' | 'phoneNumber'

