import { useEffect, useState, useCallback } from 'react';
import { collection, doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { useAuth } from '../store/useAuth';
import { Receipt } from '../models/firestore/receipt';

// Throttled logging to prevent performance issues
const logCache = new Map<string, number>();
const LOG_THROTTLE_MS = 1000; // Only log same message once per second

const logReceipt = (message: string, data?: any) => {
  const key = `${message}${data ? JSON.stringify(data) : ''}`;
  const now = Date.now();
  const lastLog = logCache.get(key) || 0;
  
  if (now - lastLog > LOG_THROTTLE_MS) {
    console.log(`[Receipt-Debug] ${message}`, data ? data : '');
    logCache.set(key, now);
  }
};

export const useReceiptTracking = (messageId: string, conversationId?: string) => {
  const { user } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Only log the call once per unique combination to prevent spam
  const logKey = `useReceiptTracking-${messageId}-${user?.uid}`;
  if (!logCache.has(logKey)) {
    logReceipt('🔄 useReceiptTracking called', { 
      messageId, 
      conversationId, 
      userId: user?.uid 
    });
    logCache.set(logKey, Date.now());
  }

  // Create a receipt when a message is first loaded/received
  // Use useCallback to prevent recreation on every render
  const createReceipt = useCallback(async () => {
    if (!user || !messageId) {
      logReceipt('⚠️ Cannot create receipt - missing user or messageId', { user: !!user, messageId });
      return null;
    }

    try {
      const receiptId = `${messageId}_${user.uid}`;
      const receiptRef = doc(firestore, 'receipts', receiptId);
      
      // Check if receipt already exists
      const existingReceipt = await getDoc(receiptRef);
      if (existingReceipt.exists()) {
        logReceipt('📧 Receipt already exists, using existing', { receiptId });
        const data = existingReceipt.data() as Omit<Receipt, 'id'>;
        return { ...data, id: existingReceipt.id };
      }

      // Create new receipt with receivedAt timestamp
      const newReceipt: Omit<Receipt, 'id'> = {
        messageId,
        userId: user.uid,
        receivedAt: serverTimestamp() as any, // Firebase will convert this
        viewedAt: null,
        ...(conversationId && { conversationId }) // Only include if defined
      };

      await setDoc(receiptRef, newReceipt);
      logReceipt('✅ Created new receipt', { receiptId, conversationId });

      // Return the receipt with current timestamp (approximate)
      return {
        id: receiptId,
        ...newReceipt,
        receivedAt: new Date() // Use current time for immediate countdown start
      } as Receipt;

    } catch (error) {
      logReceipt('❌ Error creating receipt', error);
      return null;
    }
  }, [user, messageId, conversationId]); // Include all dependencies

  // Mark message as viewed
  const markAsViewed = useCallback(async () => {
    if (!user || !messageId || !receipt) {
      logReceipt('⚠️ Cannot mark as viewed - missing data', { 
        user: !!user, 
        messageId, 
        receipt: !!receipt 
      });
      return;
    }

    try {
      const receiptRef = doc(firestore, 'receipts', receipt.id);
      await setDoc(receiptRef, {
        ...receipt,
        viewedAt: serverTimestamp()
      }, { merge: true });

      logReceipt('👁️ Marked message as viewed', { receiptId: receipt.id });
    } catch (error) {
      logReceipt('❌ Error marking as viewed', error);
    }
  }, [user, messageId, receipt]); // Memoize with proper dependencies

  // Listen for receipt updates and create receipt if needed
  useEffect(() => {
    if (!user || !messageId) {
      setIsLoading(false);
      return;
    }

    const receiptId = `${messageId}_${user.uid}`;
    const receiptRef = doc(firestore, 'receipts', receiptId);

    logReceipt('🔄 Setting up receipt listener', { receiptId });

    const unsubscribe = onSnapshot(receiptRef, async (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Omit<Receipt, 'id'>;
        const receiptData = { ...data, id: doc.id };
        
        // Convert Firestore timestamp to Date
        if (data.receivedAt && typeof data.receivedAt !== 'string') {
          receiptData.receivedAt = data.receivedAt;
        }
        
        logReceipt('📧 Receipt updated from Firestore', { receiptId, hasReceivedAt: !!receiptData.receivedAt });
        setReceipt(receiptData);
      } else {
        // Receipt doesn't exist, create it
        logReceipt('📧 No receipt found, creating new one', { receiptId });
        const newReceipt = await createReceipt();
        if (newReceipt) {
          setReceipt(newReceipt);
        }
      }
      setIsLoading(false);
    }, (error) => {
      logReceipt('❌ Receipt listener error', error);
      setIsLoading(false);
    });

    return () => {
      logReceipt('🧹 Receipt listener cleanup', { receiptId });
      unsubscribe();
    };
  }, [user, messageId, conversationId, createReceipt]); // Add createReceipt to dependencies

  // Memoize the receivedAt conversion to prevent unnecessary recalculations
  const receivedAt = receipt?.receivedAt ? (
    (() => {
      logReceipt('🕐 Converting receivedAt timestamp', { 
        receiptId: receipt.id,
        receivedAtType: typeof receipt.receivedAt,
        receivedAtValue: receipt.receivedAt,
        isDate: receipt.receivedAt instanceof Date
      });
      
      if (receipt.receivedAt instanceof Date) {
        return receipt.receivedAt;
      } else if (receipt.receivedAt && typeof receipt.receivedAt === 'object' && 'seconds' in receipt.receivedAt) {
        // Firestore timestamp object
        const convertedDate = new Date((receipt.receivedAt as any).seconds * 1000);
        logReceipt('✅ Converted Firestore timestamp to Date', { 
          original: receipt.receivedAt,
          converted: convertedDate.toISOString()
        });
        return convertedDate;
      } else {
        logReceipt('⚠️ Unknown receivedAt format, using current time', { receivedAt: receipt.receivedAt });
        return new Date(); // Fallback to current time
      }
    })()
  ) : (() => {
    logReceipt('❌ No receivedAt timestamp available', { 
      hasReceipt: !!receipt,
      receiptId: receipt?.id 
    });
    return null;
  })();

  return {
    receipt,
    isLoading,
    markAsViewed,
    receivedAt
  };
}; 