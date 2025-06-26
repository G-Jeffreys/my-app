# Group Chat Known Issues

## TTL Extension Issue with Offline Participants

**Issue**: If someone in the group chat leaves their phone off, it can artificially extend the TTL for each message by an enormous amount.

**Root Cause**: The current TTL cleanup logic for group messages requires ALL participants to have their message TTL expire before the message is deleted from the system. When a participant is offline and doesn't receive the message, no receipt is created for them, which means their TTL never starts counting down.

**Impact**: 
- Messages can persist much longer than intended
- Storage costs may increase due to messages not being cleaned up
- User expectations around message ephemerality may not be met

**Current Status**: Not currently sure how we want this to be resolved, but it doesn't cause any bugs so we will leave it alone for now.

**Potential Solutions (for future consideration)**:
1. Use a global TTL based on when the message was sent, regardless of receipt status
2. Set a maximum grace period for offline participants
3. Create receipts automatically after a certain timeout period
4. Implement a hybrid approach that considers both individual and global TTLs

**Related Code**:
- `functions/src/index.ts` - TTL cleanup logic for group messages
- `hooks/useReceiptTracking.ts` - Receipt creation and tracking
- `components/TextMessageComposer.tsx` - Group receipt creation 