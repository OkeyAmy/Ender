import { useState } from 'react';

export function useChainGPT() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const askWeb3Question = async (question: string, userId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/chaingpt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, userId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data.data.bot;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const generateContract = async (description: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/chaingpt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }
      
      return data.contract;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const auditContract = async (contractCode: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/chaingpt/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractCode })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Audit failed');
      }
      
      return data.audit;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return {
    askWeb3Question,
    generateContract,
    auditContract,
    loading,
    error
  };
}