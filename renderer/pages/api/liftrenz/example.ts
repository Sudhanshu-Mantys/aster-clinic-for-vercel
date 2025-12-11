import type { NextApiRequest, NextApiResponse } from 'next';
import { getLifeTrenzAuthToken, getLifeTrenzAuthorizationHeader, isLifeTrenzTokenExpired } from '../../../lib/liftrenz-auth-token';

/**
 * Example API route demonstrating how to use the LifeTrenz auth token
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check if token is expired
    const isExpired = await isLifeTrenzTokenExpired();

    if (isExpired) {
      return res.status(401).json({
        error: 'LifeTrenz token is expired or about to expire',
        message: 'Please refresh the token'
      });
    }

    // Get the JWT token
    const token = await getLifeTrenzAuthToken();

    // Or get the full Authorization header
    const authHeader = await getLifeTrenzAuthorizationHeader();

    // Example: Make a request to LifeTrenz API
    // const response = await fetch('https://aster-clinics-dev.mantys.org/Orion/VIZTR/..., {
    //   headers: {
    //     'Authorization': authHeader,
    //     'Content-Type': 'application/json',
    //   }
    // });

    return res.status(200).json({
      success: true,
      message: 'Token fetched successfully',
      tokenPreview: `${token.substring(0, 50)}...`,
      isExpired
    });
  } catch (error) {
    console.error('Error in example API:', error);
    return res.status(500).json({
      error: 'Failed to fetch LifeTrenz auth token',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
