import express from 'express';
import {
  accessChat, fetchChats,
  muteChat, blockChatUser, clearChat,
  setChatTheme, setChatLock, verifyChatLock,
  getChatMedia,
  createGroup, updateGroup, addToGroup, removeFromGroup, leaveGroup, deleteGroup, updateGroupSettings
} from './chat.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/',                          protectRoute, accessChat);
router.get('/',                           protectRoute, fetchChats);
router.post('/group',                     protectRoute, createGroup);
router.put('/group',                      protectRoute, updateGroup);
router.put('/group/add',                  protectRoute, addToGroup);
router.put('/group/remove',               protectRoute, removeFromGroup);
router.put('/group/leave',                protectRoute, leaveGroup);
router.delete('/group/:chatId',           protectRoute, deleteGroup);
router.put('/group/settings',             protectRoute, updateGroupSettings);
router.post('/:chatId/mute',              protectRoute, muteChat);
router.post('/:chatId/block',             protectRoute, blockChatUser);
router.delete('/:chatId/messages',        protectRoute, clearChat);
router.post('/:chatId/theme',             protectRoute, setChatTheme);
router.post('/:chatId/lock',              protectRoute, setChatLock);
router.post('/:chatId/verify-lock',       protectRoute, verifyChatLock);
router.get('/:chatId/media',              protectRoute, getChatMedia);

export default router;
