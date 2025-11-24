import { Router } from 'express';
import {user_request_save, getLocationDate, getLocationCenter}  from '../controllers/MapController';


const router = Router();

router.post('/save', user_request_save);
router.get('/location', getLocationDate);
router.post('/location-center', getLocationCenter);

export default router;