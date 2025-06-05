import { Router } from 'express';
import { 
  createEvent, 
  getEvents, 
  getEventDetails, 
  updateEvent,
  deleteEvent,
  createEventValidation 
} from '../controllers/eventsController';
import { 
  submitVote, 
  addTimeSlot, 
  generateGuestVotingLink, 
  finalizeVotingEvent,
  voteValidation 
} from '../controllers/votingController';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { eventValidation, validateDateRange, handleValidationErrors } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Event routes
router.post('/', authenticateToken, eventValidation, validateDateRange, handleValidationErrors, asyncHandler(createEvent));
router.get('/', authenticateToken, asyncHandler(getEvents));
router.get('/:id', optionalAuth, asyncHandler(getEventDetails));
router.put('/:id', authenticateToken, eventValidation, validateDateRange, handleValidationErrors, asyncHandler(updateEvent));
router.delete('/:id', authenticateToken, asyncHandler(deleteEvent));

// Voting routes
router.post('/:id/vote', optionalAuth, voteValidation, handleValidationErrors, asyncHandler(submitVote));
router.post('/:eventId/time-slots', authenticateToken, asyncHandler(addTimeSlot));
router.post('/:eventId/guest-link', authenticateToken, asyncHandler(generateGuestVotingLink));
router.post('/:eventId/finalize', authenticateToken, asyncHandler(finalizeVotingEvent));

export default router;