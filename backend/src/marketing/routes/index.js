import express from 'express';
import { initiateMetaAuth, handleMetaCallback, disconnectMeta, initiateGoogleAuth, handleGoogleCallback, disconnectGoogle } from '../controllers/oauth.controller.js';
import { getEligibleCustomers, sendWhatsAppCampaign } from '../controllers/whatsapp.controller.js';
import * as metaController from '../controllers/meta.controller.js';
import { verifyToken, authorize } from '../../middleware/auth.js';

const router = express.Router();

// Public OAuth Callback Routes (Redirected from Meta and Google)
router.get('/marketing/oauth/meta/callback', handleMetaCallback);
router.get('/marketing/oauth/google/callback', handleGoogleCallback);

// Dashboard
router.get('/marketing/dashboard', verifyToken, authorize(['marketing.view', 'marketing.manage']), (req, res) => {
    res.json({
        success: true,
        message: 'Marketing dashboard data',
        data: []
    });
});

// Meta OAuth Initiate & Disconnect
router.get('/marketing/oauth/meta', verifyToken, authorize(['marketing.manage']), initiateMetaAuth);
router.post('/marketing/oauth/meta/disconnect', verifyToken, authorize(['marketing.manage']), disconnectMeta);

// Google OAuth Initiate & Disconnect
router.get('/marketing/oauth/google', verifyToken, authorize(['marketing.manage']), initiateGoogleAuth);
router.post('/marketing/oauth/google/disconnect', verifyToken, authorize(['marketing.manage']), disconnectGoogle);

// Meta Marketing API Routes
router.get('/marketing/meta/test', verifyToken, authorize(['marketing.view', 'marketing.manage']), metaController.testMetaConnection);
router.get('/marketing/meta/account', verifyToken, authorize(['marketing.view', 'marketing.manage']), metaController.getAdAccount);
router.get('/marketing/meta/campaigns', verifyToken, authorize(['marketing.view', 'marketing.manage']), metaController.getCampaigns);
router.get('/marketing/meta/campaigns/:campaignId/insights', verifyToken, authorize(['marketing.view', 'marketing.manage']), metaController.getCampaignInsights);
router.get('/marketing/meta/insights', verifyToken, authorize(['marketing.view', 'marketing.manage']), metaController.getAdAccountInsights);
router.get('/marketing/meta/adsets', verifyToken, authorize(['marketing.view', 'marketing.manage']), metaController.getAdSets);
router.get('/marketing/meta/ads', verifyToken, authorize(['marketing.view', 'marketing.manage']), metaController.getAds);
router.post('/marketing/meta/campaigns', verifyToken, authorize(['marketing.manage']), metaController.createCampaign);
router.patch('/marketing/meta/campaigns/:campaignId/status', verifyToken, authorize(['marketing.manage']), metaController.updateCampaignStatus);
router.get('/marketing/meta/audiences', verifyToken, authorize(['marketing.view', 'marketing.manage']), metaController.getCustomAudiences);

router.get('/marketing/campaigns', verifyToken, authorize(['marketing.view', 'marketing.manage']), (req, res) => {
    res.json({
        success: true,
        message: 'Retrieved campaigns',
        data: []
    });
});

// WhatsApp Campaign Routes
router.get('/marketing/whatsapp/customers', verifyToken, authorize(['marketing.view', 'marketing.manage']), getEligibleCustomers);
router.post('/marketing/whatsapp/send', verifyToken, authorize(['marketing.manage']), sendWhatsAppCampaign);

export default router;
