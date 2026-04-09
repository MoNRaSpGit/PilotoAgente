import { Router } from 'express';
import { streamEventsController } from '../modules/events/event.controller.js';

const router = Router();

router.get('/events', streamEventsController);

export default router;
