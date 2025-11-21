import { Router } from 'express';
import {custom_request, getLocationDate, getLocationCenter}  from '../controllers/MapController';


const router = Router();

router.post('/save', custom_request);
router.get('/location', getLocationDate);
router.post('/location-center', getLocationCenter);

export default router;