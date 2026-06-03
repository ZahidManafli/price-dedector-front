import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import PartnersManagement from '../components/PartnersManagement';
import ZikAccounts from '../components/ZikAccounts';
import ReferralManagementTab from '../components/ReferralManagementTab';
import { ShieldCheck, Users, UserPlus, Pencil, ListChecks, PackageOpen, RefreshCw, Search, Trash2, AlertTriangle, CalendarClock, Clock3, ShieldAlert } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { TAB_KEYS, USER_DEFAULT_ALLOWED_TABS } from '../utils/planAccess';
import * as XLSX from 'xlsx';
import { NotificationsTab } from '../components/NotificationsTab';

function safeToString(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

function formatPlanCategory(category) {
  const normalized = String(category || 'subscription')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');

  if (normalized === 'analytics' || normalized === 'analysis' || normalized === 'data_analytics') {
    return 'analytics';
  }
  if (normalized === 'amazon_monitoring' || normalized === 'amazonmonitoring') {
    return 'amazon monitoring';
  }
  if (normalized === 'custom') {
    return 'custom';
  }
  return 'subscription';
}

function formatRequestTypeLabel(requestType) {
  return String(requestType || 'subscription').replace(/_/g, ' ');
}

function defaultEditForUser(u) {
  return {
    role: u.role || 'user',
    referralAdmin: !!u?.permissions?.referralAdmin,
    amazonLookupRequestLimitPerWeek: safeToString(u.amazonLookupRequestLimitPerWeek),
    productsLimit: safeToString(u.productsLimit),
    marketAnalysisCreditsLimit: safeToString(u.marketAnalysisCreditsLimit),
    ebayAccountsLimit: safeToString(u.ebayAccountsLimit),
    isIt6HourChecker: !!u.isIt6HourChecker,
    isUntouched: !!u.isUntouched,   // ✅ add this
  };
}

const PLAN_TAB_KEYS = [
  TAB_KEYS.PRODUCTS,
  TAB_KEYS.LISTINGS,
  TAB_KEYS.ORDERS,
  TAB_KEYS.AMAZON_LOOKUP,
  TAB_KEYS.EBAY_CALCULATOR,
  TAB_KEYS.MARKET_ANALYSIS,
  TAB_KEYS.DEWISO,
  TAB_KEYS.SETTINGS,
];

function defaultPlanForm() {
  return {
    id: '',
    name: '',
    category: 'subscription',
    price: '',
    actualPrice: '',
    discountedPrice: '',
    currency: 'AZN',
    duration: '',
    description: '',
    featuresText: '',
    amazonLookupLimitPerWeek: '',
    productsLimit: '',
    marketAnalysisCreditsLimit: '',
    ebayAccountsLimit: '',
    isIt6HourChecker: false,
    featured: false,
    isActive: true,
    allowedTabs: [...USER_DEFAULT_ALLOWED_TABS.filter((key) => key !== TAB_KEYS.DASHBOARD)],
  };
}

export default function AdminPanelPage() {
  const { isDark } = useTheme();
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  const [users, setUsers] = useState([]);
  const [userBlockFilter, setUserBlockFilter] = useState('all'); // all | blocked | unblocked
  const [ipModal, setIpModal] = useState({ open: false, user: null, ipHistory: [] });
  const [requests, setRequests] = useState([]);
  const [plans, setPlans] = useState([]);

  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user',
    referralAdmin: false,
    amazonLookupRequestLimitPerWeek: '',
    productsLimit: '',
    marketAnalysisCreditsLimit: '',
    ebayAccountsLimit: '',
  });

  const [edits, setEdits] = useState({});
  const [resetUsage, setResetUsage] = useState({});
  const [requestAction, setRequestAction] = useState({});
  const [planForm, setPlanForm] = useState(defaultPlanForm());
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [dangerWindow, setDangerWindow] = useState('3d');
  const [dangerSubmitting, setDangerSubmitting] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: 'Scheduled maintenance',
    message: 'We are performing a planned maintenance update. Non-admin access will be paused during this window.',
    startAt: '',
    endAt: '',
  });
  const [maintenanceWindows, setMaintenanceWindows] = useState([]);
  const [maintenanceFlag, setMaintenanceFlag] = useState({ active: false, source: null, manualActive: null });
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [stripeWebhookEvents, setStripeWebhookEvents] = useState([]);
  const [stripeWebhookLoading, setStripeWebhookLoading] = useState(false);
  const [stripeWebhookDetailLoading, setStripeWebhookDetailLoading] = useState(false);
  const [stripeWebhookSelected, setStripeWebhookSelected] = useState(null);
  const [stripeWebhookReprocessingId, setStripeWebhookReprocessingId] = useState('');
  const [stripeWebhookFilters, setStripeWebhookFilters] = useState({
    eventType: '',
    processed: 'all',
    limit: 50,
  });

  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users]);

  const refreshData = async () => {
    const [usersRes, plansRes, requestsRes, notifRes, maintenanceRes] = await Promise.all([
      adminAPI.listUsers(),
      adminAPI.listPlans(),
      adminAPI.listSubscriptionRequests(),
      adminAPI.listNotifications(),
      adminAPI.listMaintenanceWindows(),
    ]);

    const usersList = usersRes?.data?.users || [];
    const editsMap = {};
    for (const u of usersList) editsMap[u.id] = defaultEditForUser(u);

    setUsers(usersList);
    setEdits(editsMap);
    setPlans(plansRes?.data?.plans || []);
    setRequests(requestsRes?.data?.requests || []);
    setNotifHistory(notifRes?.data?.notifications || []);
    setMaintenanceWindows(maintenanceRes?.data?.windows || []);
    setMaintenanceFlag(maintenanceRes?.data?.flag || { active: false, source: null, manualActive: null });
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setAlert(null);
        await refreshData();
      } catch (err) {
        setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToLoadAdminData') });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const [notifForm, setNotifForm] = useState({ header: '', message: '' });
  const [notifHistory, setNotifHistory] = useState([]);
  const [notifSending, setNotifSending] = useState(false);

  const onCreateUser = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!createForm.email || !createForm.password || !createForm.name) {
      setAlert({ type: 'warning', message: t('adminPanelPage.emailPasswordNameRequired') });
      return;
    }

    try {
      setLoading(true);
      await adminAPI.createUser({
        email: createForm.email.trim(),
        password: createForm.password,
        name: createForm.name.trim(),
        role: createForm.role === 'admin' ? 'admin' : 'user',
        referralAdmin: !!createForm.referralAdmin,
        amazonLookupRequestLimitPerWeek:
          createForm.amazonLookupRequestLimitPerWeek === ''
            ? null
            : Number(createForm.amazonLookupRequestLimitPerWeek),
        productsLimit: createForm.productsLimit === '' ? null : Number(createForm.productsLimit),
        marketAnalysisCreditsLimit:
          createForm.marketAnalysisCreditsLimit === ''
            ? null
            : Number(createForm.marketAnalysisCreditsLimit),
        ebayAccountsLimit:
          createForm.ebayAccountsLimit === '' ? null : Number(createForm.ebayAccountsLimit),
      });

      setCreateForm({
        email: '',
        password: '',
        name: '',
        role: 'user',
        referralAdmin: false,
        amazonLookupRequestLimitPerWeek: '',
        productsLimit: '',
        marketAnalysisCreditsLimit: '',
        ebayAccountsLimit: '',
      });

      await refreshData();
      setAlert({ type: 'success', message: t('adminPanelPage.userCreatedSuccessfully') });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToCreateUser') });
    } finally {
      setLoading(false);
    }
  };

  const onSaveLimits = async (userId) => {
    setAlert(null);
    try {
      setLoading(true);
      const uEdits = edits[userId];
      if (!uEdits) return;

      await adminAPI.updateUserLimits(userId, {
        role: uEdits.role === 'admin' ? 'admin' : 'user',
        referralAdmin: !!uEdits.referralAdmin,
        amazonLookupRequestLimitPerWeek:
          uEdits.amazonLookupRequestLimitPerWeek === ''
            ? null
            : Number(uEdits.amazonLookupRequestLimitPerWeek),
        productsLimit: uEdits.productsLimit === '' ? null : Number(uEdits.productsLimit),
        marketAnalysisCreditsLimit:
          uEdits.marketAnalysisCreditsLimit === '' ? null : Number(uEdits.marketAnalysisCreditsLimit),
        ebayAccountsLimit:
          uEdits.ebayAccountsLimit === '' ? null : Number(uEdits.ebayAccountsLimit),
        resetAmazonUsage: !!resetUsage[userId],
        resetMarketAnalysisUsage: !!resetUsage[`${userId}__marketAnalysis`],
        isUntouched: !!uEdits.isUntouched,
        isIt6HourChecker: !!uEdits.isIt6HourChecker,
      });

      await refreshData();
      setResetUsage({});
      setAlert({ type: 'success', message: t('adminPanelPage.userLimitsUpdated') });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToUpdateLimits') });
    } finally {
      setLoading(false);
    }
  };

  const onSavePlan = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!planForm.name.trim()) {
      setAlert({ type: 'warning', message: t('adminPanelPage.planNameRequired') });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: planForm.name.trim(),
        category: planForm.category,
        price: planForm.price.trim(),
        actualPrice: planForm.actualPrice === '' ? null : Number(planForm.actualPrice),
        discountedPrice: planForm.discountedPrice === '' ? null : Number(planForm.discountedPrice),
        currency: planForm.currency || 'AZN',
        duration: planForm.duration.trim(),
        description: planForm.description.trim(),
        features: planForm.featuresText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        amazonLookupLimitPerWeek:
          planForm.amazonLookupLimitPerWeek === '' ? null : Number(planForm.amazonLookupLimitPerWeek),
        productsLimit: planForm.productsLimit === '' ? null : Number(planForm.productsLimit),
        marketAnalysisCreditsLimit:
          planForm.marketAnalysisCreditsLimit === ''
            ? null
            : Number(planForm.marketAnalysisCreditsLimit),
        ebayAccountsLimit:
          planForm.ebayAccountsLimit === '' ? null : Number(planForm.ebayAccountsLimit),
        featured: !!planForm.featured,
        isActive: !!planForm.isActive,
        allowedTabs: planForm.allowedTabs,
      };

      if (planForm.id) {
        await adminAPI.updatePlan(planForm.id, payload);
      } else {
        await adminAPI.createPlan(payload);
      }

      await refreshData();
      setPlanForm(defaultPlanForm());
      setAlert({ type: 'success', message: t('adminPanelPage.planSavedSuccessfully') });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToSavePlan') });
    } finally {
      setLoading(false);
    }
  };

  const startEditPlan = (plan) => {
    setPlanForm({
      id: plan.id,
      name: plan.name || '',
      category:
        plan.category === 'analytics'
          ? 'analytics'
          : plan.category === 'amazon_monitoring'
            ? 'amazon_monitoring'
            : 'subscription',
      price: plan.price || '',
      actualPrice: safeToString(plan.actualPrice),
      discountedPrice: safeToString(plan.discountedPrice),
      currency: plan.currency || 'AZN',
      duration: plan.duration || '',
      description: plan.description || '',
      featuresText: Array.isArray(plan.features) ? plan.features.join('\n') : '',
      amazonLookupLimitPerWeek: safeToString(plan.amazonLookupLimitPerWeek),
      allowedTabs: Array.isArray(plan.allowedTabs)
        ? plan.allowedTabs.filter((key) => key !== TAB_KEYS.DASHBOARD)
        : [...USER_DEFAULT_ALLOWED_TABS.filter((key) => key !== TAB_KEYS.DASHBOARD)],
      productsLimit: safeToString(plan.productsLimit),
      marketAnalysisCreditsLimit: safeToString(plan.marketAnalysisCreditsLimit),
      ebayAccountsLimit: safeToString(plan.ebayAccountsLimit),
      featured: !!plan.featured,
      isActive: plan.isActive !== false,
    });
  };

  const onSyncPlanToStripe = async (planId) => {
    setAlert(null);
    try {
      setLoading(true);
      await adminAPI.syncPlanToStripe(planId);
      await refreshData();
      setAlert({ type: 'success', message: 'Plan synced to Stripe successfully.' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to sync plan to Stripe.' });
    } finally {
      setLoading(false);
    }
  };

  const onApproveRequest = async (requestId) => {
    const action = requestAction[requestId] || {};

    try {
      setLoading(true);
      await adminAPI.approveSubscriptionRequest(requestId, {
        adminNote: action.adminNote || '',
      });
      await refreshData();
      setAlert({ type: 'success', message: t('adminPanelPage.requestApproved') });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToApproveRequest') });
    } finally {
      setLoading(false);
    }
  };

  const onRejectRequest = async (requestId) => {
    const action = requestAction[requestId] || {};
    try {
      setLoading(true);
      await adminAPI.rejectSubscriptionRequest(requestId, { adminNote: action.adminNote || '' });
      await refreshData();
      setAlert({ type: 'success', message: t('adminPanelPage.requestRejected') });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToRejectRequest') });
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = useMemo(
    () => requests.filter((r) => (r.status || 'pending') === 'pending'),
    [requests]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    let list = users;
    if (userBlockFilter === 'blocked') list = list.filter((u) => u.isBlocked);
    if (userBlockFilter === 'unblocked') list = list.filter((u) => !u.isBlocked);
    if (!q) return list;
    return list.filter((u) => {
      const name = String(u.name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const plan = String(u.selectedPlanName || '').toLowerCase();
      return name.includes(q) || email.includes(q) || plan.includes(q);
    });
  }, [users, userSearch, userBlockFilter]);
  const handleBlockUser = async (userId) => {
    const { value: reason } = await Swal.fire({
      title: t('adminPanelPage.blockUserTitle'),
      input: 'text',
      inputLabel: t('adminPanelPage.blockReasonLabel'),
      inputPlaceholder: t('adminPanelPage.blockReasonPlaceholder'),
      showCancelButton: true,
      confirmButtonText: t('adminPanelPage.block'),
      confirmButtonColor: '#dc2626',
      inputValidator: (v) => v.length > 255 ? t('adminPanelPage.reasonTooLong') : undefined,
    });
    if (reason === undefined) return;
    try {
      setLoading(true);
      await adminAPI.blockUser(userId, reason);
      await refreshData();
      setAlert({ type: 'success', message: t('adminPanelPage.userBlocked') });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToBlockUser') });
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockUser = async (userId) => {
    try {
      setLoading(true);
      await adminAPI.unblockUser(userId);
      await refreshData();
      setAlert({ type: 'success', message: t('adminPanelPage.userUnblocked') });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToUnblockUser') });
    } finally {
      setLoading(false);
    }
  };

  const handleShowIpHistory = async (user) => {
    try {
      setLoading(true);
      const res = await adminAPI.getUserIpHistory(user.id);
      setIpModal({ open: true, user, ipHistory: res?.data?.ipHistory || [] });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToLoadIpHistory') });
    } finally {
      setLoading(false);
    }
  };

  const exportUsersToExcel = () => {
    const rows = (filteredUsers || []).map((u) => ({
      ID: u.id || '',
      Email: u.email || '',
      Name: u.name || '',
      Role: u.role || '',
      UID: u.uid || '',
      'Plan Name': u.selectedPlanName || '',
      'Plan Activated At': u.planActivatedAt ? new Date(u.planActivatedAt).toISOString() : '',
      'Plan Expires At': u.planExpiresAt ? new Date(u.planExpiresAt).toISOString() : '',
      'Product Count': Number(u.productCount || 0),
      'Amazon Lookup Limit / Week': u.amazonLookupRequestLimitPerWeek ?? '',
      'Amazon Lookup Used This Week': u.amazonLookupRequestsUsedThisWeek ?? '',
      'Amazon Lookup Reset At': u.amazonLookupRequestsResetAt || '',
      'Products Limit': u.productsLimit ?? '',
      'Market Analysis Credits Limit': u.marketAnalysisCreditsLimit ?? '',
      'Market Analysis Credits Used': u.marketAnalysisCreditsUsed ?? '',
      'eBay Accounts Limit': u.ebayAccountsLimit ?? '',
      'eBay Connected Accounts': u.ebayConnectedAccounts ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');

    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    XLSX.writeFile(wb, `users_export_${y}-${m}-${d}.xlsx`);
  };

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIds.includes(u.id));

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllFiltered = () => {
    setSelectedUserIds((prev) => {
      if (allFilteredSelected) {
        return prev.filter((id) => !filteredUsers.some((u) => u.id === id));
      }
      const next = new Set(prev);
      for (const u of filteredUsers) next.add(u.id);
      return Array.from(next);
    });
  };

  const onRefreshSubscriptions = async (all = false) => {
    try {
      setLoading(true);
      await adminAPI.refreshSubscriptions(all ? { selectAll: true } : { userIds: selectedUserIds });
      await refreshData();
      setAlert({ type: 'success', message: t('adminPanelPage.subscriptionsRefreshed') });
      if (!all) setSelectedUserIds([]);
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToRefreshSubscriptions') });
    } finally {
      setLoading(false);
    }
  };

  const onDeleteUsers = async (all = false) => {
    const hasTarget = all || selectedUserIds.length > 0;
    if (!hasTarget) {
      setAlert({ type: 'warning', message: t('adminPanelPage.selectUsersFirst') });
      return;
    }

    const confirmed = window.confirm(
      all
        ? t('adminPanelPage.confirmRemoveAllUsers')
        : t('adminPanelPage.confirmRemoveSelectedUsers')
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await adminAPI.deleteUsers(all ? { selectAll: true } : { userIds: selectedUserIds });
      await refreshData();
      setSelectedUserIds([]);
      setAlert({ type: 'success', message: all ? t('adminPanelPage.allUsersRemoved') : t('adminPanelPage.selectedUsersRemoved') });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToRemoveUsers') });
    } finally {
      setLoading(false);
    }
  };

  const onDeleteSingleUser = async (userId) => {
    const confirmed = window.confirm(
      t('adminPanelPage.confirmRemoveSingleUser')
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await adminAPI.deleteUsers({ userIds: [userId] });
      await refreshData();
      setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
      setAlert({ type: 'success', message: t('adminPanelPage.userRemoved') });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToRemoveUser') });
    } finally {
      setLoading(false);
    }
  };

  const onPurgeSearchCache = async () => {
    const labelMap = {
      '3d': t('adminPanelPage.within3Days'),
      '7d': t('adminPanelPage.within7Days'),
      '1m': t('adminPanelPage.within1Month'),
      '1y': t('adminPanelPage.within1Year'),
      all: t('adminPanelPage.allSearchRecords'),
    };
    const label = labelMap[dangerWindow] || dangerWindow;
    const confirmed = window.confirm(t('adminPanelPage.confirmDeleteSearchRecords', { label }));
    if (!confirmed) return;

    try {
      setDangerSubmitting(true);
      setAlert(null);
      const response = await adminAPI.purgeSearchCache({ window: dangerWindow });
      setAlert({
        type: 'success',
        message: response?.data?.message || t('adminPanelPage.searchCacheDeletedSuccessfully'),
      });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToDeleteSearchCache') });
    } finally {
      setDangerSubmitting(false);
    }
  };

  const onSendNotification = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (!notifForm.header.trim()) {
      setAlert({ type: 'warning', message: t('adminPanelPage.notificationHeaderRequired') });
      return;
    }
    if (!notifForm.message.trim()) {
      setAlert({ type: 'warning', message: t('adminPanelPage.notificationMessageRequired') });
      return;
    }
    try {
      setNotifSending(true);
      const res = await adminAPI.sendNotification({
        header: notifForm.header.trim(),
        message: notifForm.message.trim(),
      });
      setNotifForm({ header: '', message: '' });
      setAlert({ type: 'success', message: res?.data?.message || t('adminPanelPage.notificationQueuedSuccessfully') });
      // Refresh history after a short delay to allow DB write
      setTimeout(() => refreshData(), 1500);
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || t('adminPanelPage.failedToSendNotification') });
    } finally {
      setNotifSending(false);
    }
  };

  const onCreateMaintenance = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!maintenanceForm.title.trim()) {
      setAlert({ type: 'warning', message: 'Maintenance title is required' });
      return;
    }
    if (!maintenanceForm.message.trim()) {
      setAlert({ type: 'warning', message: 'Maintenance message is required' });
      return;
    }
    if (!maintenanceForm.startAt) {
      setAlert({ type: 'warning', message: 'Maintenance start time is required' });
      return;
    }
    if (!maintenanceForm.endAt) {
      setAlert({ type: 'warning', message: 'Maintenance end time is required' });
      return;
    }

    try {
      setMaintenanceSubmitting(true);
      const res = await adminAPI.createMaintenanceWindow({
        title: maintenanceForm.title.trim(),
        message: maintenanceForm.message.trim(),
        startAt: maintenanceForm.startAt,
        endAt: maintenanceForm.endAt,
      });
      setAlert({ type: 'success', message: res?.data?.message || 'Maintenance window created successfully' });
      setMaintenanceForm((prev) => ({
        ...prev,
        startAt: '',
        endAt: '',
      }));
      setTimeout(() => refreshData(), 1500);
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to create maintenance window' });
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  const onSetMaintenanceFlag = async (active) => {
    setAlert(null);
    try {
      setMaintenanceSubmitting(true);
      const res = await adminAPI.updateMaintenanceFlag({ active });
      setMaintenanceFlag(res?.data?.flag || { active: !!active, source: 'manual', manualActive: !!active });
      await refreshData();
      setAlert({
        type: 'success',
        message: res?.data?.message || `Maintenance mode set to ${active ? 'active' : 'passive'}`,
      });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to update maintenance mode' });
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  const formatMaintenanceTime = (value) => {
    if (!value) return 'n/a';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'n/a';
    const plusFour = new Date(date.getTime() + 4 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(plusFour);
  };

  const loadStripeWebhooks = async (nextFilters = stripeWebhookFilters) => {
    try {
      setStripeWebhookLoading(true);
      const processed = nextFilters.processed === 'all' ? undefined : nextFilters.processed;
      const response = await adminAPI.listStripeWebhooks({
        eventType: nextFilters.eventType || undefined,
        processed,
        limit: nextFilters.limit,
      });
      setStripeWebhookEvents(response?.data?.events || []);
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to load Stripe webhook events' });
    } finally {
      setStripeWebhookLoading(false);
    }
  };

  const loadStripeWebhookDetail = async (id) => {
    if (!id) return;
    try {
      setStripeWebhookDetailLoading(true);
      const response = await adminAPI.getStripeWebhookById(id);
      setStripeWebhookSelected(response?.data?.event || null);
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to load webhook details' });
    } finally {
      setStripeWebhookDetailLoading(false);
    }
  };

  const onReprocessStripeWebhook = async (id) => {
    const confirmed = await Swal.fire({
      title: 'Reprocess webhook event?',
      text: 'This will re-run event handling logic for the selected Stripe event.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reprocess',
      cancelButtonText: 'Cancel',
    });

    if (!confirmed.isConfirmed) return;

    try {
      setStripeWebhookReprocessingId(id);
      const response = await adminAPI.reprocessStripeWebhook(id);
      setAlert({ type: 'success', message: response?.data?.message || 'Webhook reprocessed successfully' });
      await loadStripeWebhooks();
      if (stripeWebhookSelected?.id === id) {
        await loadStripeWebhookDetail(id);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to reprocess webhook event' });
    } finally {
      setStripeWebhookReprocessingId('');
    }
  };

  useEffect(() => {
    if (activeTab !== 'stripe-webhooks') return;
    loadStripeWebhooks();
  }, [activeTab]);

  return (
    <div className="page-shell">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ShieldCheck size={20} className="text-blue-600" />
              {t('adminPanelPage.title')}
            </h1>
            <p className="page-subtitle">
              {t('adminPanelPage.adminUsers')}: <span className="font-semibold">{adminCount}</span>
            </p>
          </div>
        </div>

        <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('users')}
          >
            {t('adminPanelPage.usersTab')}
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('requests')}
          >
            {t('adminPanelPage.requestsTab')}
          </button>
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'zik-accounts' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
              onClick={() => setActiveTab('zik-accounts')}
            >
              Zik Accounts
            </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'plans' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('plans')}
          >
            {t('adminPanelPage.plansTab')}
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'referrals' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('referrals')}
          >
            Referals
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'partners' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('partners')}
          >
            {t('adminPanelPage.partnersTab')}
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'notifications' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('notifications')}
          >
            {t('adminPanelPage.notificationsTab')}
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'maintenance' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('maintenance')}
          >
            Maintenance
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'stripe-webhooks' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('stripe-webhooks')}
          >
            Stripe Webhooks
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'danger' ? 'bg-red-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('danger')}
          >
            {t('adminPanelPage.dangerZoneTab')}
          </button>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} autoClose={false} />
          </div>
        )}

        {loading && <LoadingSpinner />}

        {!loading && activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-4 lg:gap-6">
            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <UserPlus size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('adminPanelPage.createUser')}</h2>
              </div>

              <form onSubmit={onCreateUser} className="space-y-3">
                <input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.name')} type="text" />
                <input value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.email')} type="email" />
                <input value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.temporaryPassword')} type="password" />

                <select value={createForm.role} onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))} className="input-base">
                  <option value="user">{t('adminPanelPage.userRole')}</option>
                  <option value="admin">{t('adminPanelPage.adminRole')}</option>
                </select>

                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!createForm.referralAdmin}
                    onChange={(e) => setCreateForm((p) => ({ ...p, referralAdmin: e.target.checked }))}
                  />
                  Referral admin access
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <input value={createForm.amazonLookupRequestLimitPerWeek} onChange={(e) => setCreateForm((p) => ({ ...p, amazonLookupRequestLimitPerWeek: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.amazonPerWeek')} type="number" min="0" />
                  <input value={createForm.productsLimit} onChange={(e) => setCreateForm((p) => ({ ...p, productsLimit: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.products')} type="number" min="0" />
                </div>
                <input
                  value={createForm.marketAnalysisCreditsLimit}
                  onChange={(e) => setCreateForm((p) => ({ ...p, marketAnalysisCreditsLimit: e.target.value }))}
                  className="input-base"
                  placeholder={t('adminPanelPage.checkilaCredits')}
                  type="number"
                  min="0"
                />
                <input
                  value={createForm.ebayAccountsLimit}
                  onChange={(e) => setCreateForm((p) => ({ ...p, ebayAccountsLimit: e.target.value }))}
                  className="input-base"
                  placeholder={t('adminPanelPage.ebayAccountsLimit')}
                  type="number"
                  min="0"
                />

                <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                  <Users size={16} />
                  {t('adminPanelPage.createAccess')}
                </button>
              </form>
            </div>

            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('adminPanelPage.users')}</h2>
              </div>

              <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto_auto_auto]">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="input-base pl-9"
                    placeholder={t('adminPanelPage.searchUsersPlaceholder')}
                  />
                </div>
                <button type="button" onClick={toggleSelectAllFiltered} className="btn-secondary px-3 py-2 text-xs">
                  {allFilteredSelected ? t('adminPanelPage.unselectAll') : t('adminPanelPage.selectFiltered')}
                </button>
                <button
                  type="button"
                  onClick={exportUsersToExcel}
                  disabled={filteredUsers.length === 0}
                  className="btn-secondary px-3 py-2 text-xs disabled:opacity-60"
                  title={t('adminPanelPage.exportsCurrentFilteredList')}
                >
                  {t('adminPanelPage.exportExcel')}
                </button>
                <select
                  value={userBlockFilter}
                  onChange={e => setUserBlockFilter(e.target.value)}
                  className="input-base text-xs"
                  style={{ minWidth: 120 }}
                >
                  <option value="all">{t('adminPanelPage.allUsers')}</option>
                  <option value="blocked">{t('adminPanelPage.blockedOnly')}</option>
                  <option value="unblocked">{t('adminPanelPage.unblockedOnly')}</option>
                </select>
                <button
                  type="button"
                  onClick={() => onRefreshSubscriptions(false)}
                  disabled={selectedUserIds.length === 0}
                  className="btn-primary px-3 py-2 text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <RefreshCw size={13} /> {t('adminPanelPage.refreshPlusOneMonth')}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteUsers(false)}
                  disabled={selectedUserIds.length === 0}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  {t('adminPanelPage.removeSelected')}
                </button>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRefreshSubscriptions(true)}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  {t('adminPanelPage.refreshAllUsersPlusOneMonth')}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteUsers(true)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  {t('adminPanelPage.removeAllUsers')}
                </button>
              </div>

              <div className="space-y-3">
                {filteredUsers.map((u) => {
                  const rowEdits = edits[u.id] || defaultEditForUser(u);
                  return (
                    <div key={u.id} className={`border rounded-xl p-3 ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'} ${u.isBlocked ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={() => toggleSelectUser(u.id)}
                            className="mt-0.5"
                          />
                          <span className="text-sm font-semibold">{u.name || t('adminPanelPage.user')} ({u.email})</span>
                          {u.isBlocked && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">{t('adminPanelPage.blocked')}</span>
                          )}
                          {u.isUntouched && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                              {t('adminPanelPage.untouched')}
                            </span>
                          )}
                          {u.isIt6HourChecker && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold inline-flex items-center gap-1">
                              <Clock3 size={10} /> 6h checker
                            </span>
                          )}
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleShowIpHistory(u)}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            title={t('adminPanelPage.viewIpHistory')}
                          >
                            {t('adminPanelPage.ips')}
                          </button>
                          {u.isBlocked ? (
                            <button
                              type="button"
                              onClick={() => handleUnblockUser(u.id)}
                              className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
                              title={t('adminPanelPage.unblockUser')}
                            >
                              {t('adminPanelPage.unblock')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBlockUser(u.id)}
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                              title={t('adminPanelPage.blockUser')}
                            >
                              {t('adminPanelPage.block')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteSingleUser(u.id)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 inline-flex items-center gap-1"
                            title={t('adminPanelPage.removeUser')}
                          >
                            <Trash2 size={12} /> {t('adminPanelPage.remove')}
                          </button>
                        </div>
                            {/* IP History Modal */}
                            {ipModal.open && (
                              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                                <div className={`rounded-xl shadow-lg max-w-lg w-full bg-white dark:bg-slate-900 border p-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                  <div className="flex items-center justify-between mb-4">
                                    <div>
                                      <div className="font-semibold text-lg">{t('adminPanelPage.ipHistoryFor', { email: ipModal.user?.email })}</div>
                                      {ipModal.user?.isBlocked && <div className="text-xs text-red-600 font-semibold">{t('adminPanelPage.blocked')}</div>}
                                    </div>
                                    <button className="text-xl font-bold" onClick={() => setIpModal({ open: false, user: null, ipHistory: [] })}>{t('adminPanelPage.close')}</button>
                                  </div>
                                  <div className="overflow-x-auto max-h-96">
                                    <table className="w-full text-xs border">
                                      <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-800">
                                          <th className="p-2 border">{t('adminPanelPage.ip')}</th>
                                          <th className="p-2 border">{t('adminPanelPage.country')}</th>
                                          <th className="p-2 border">{t('adminPanelPage.city')}</th>
                                          <th className="p-2 border">{t('adminPanelPage.region')}</th>
                                          <th className="p-2 border">{t('adminPanelPage.timezone')}</th>
                                          <th className="p-2 border">{t('adminPanelPage.device')}</th>
                                          <th className="p-2 border">{t('adminPanelPage.model')}</th>
                                          <th className="p-2 border">{t('adminPanelPage.date')}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ipModal.ipHistory.length === 0 ? (
                                          <tr><td colSpan={8} className="text-center p-4">{t('adminPanelPage.noIpHistoryFound')}</td></tr>
                                        ) : (
                                          ipModal.ipHistory.map((row, idx) => (
                                            <tr key={idx}>
                                              <td className="border p-1">{row.ip}</td>
                                              <td className="border p-1">{row.country}</td>
                                              <td className="border p-1">{row.city}</td>
                                              <td className="border p-1">{row.region}</td>
                                              <td className="border p-1">{row.timezone}</td>
                                              <td className="border p-1">{row.device}</td>
                                              <td className="border p-1">{row.device_model}</td>
                                              <td className="border p-1">{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{t('adminPanelPage.plan')}: {u.selectedPlanName || t('adminPanelPage.customNone')}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {t('adminPanelPage.expires')}: {u.planExpiresAt ? new Date(u.planExpiresAt).toLocaleDateString() : t('adminPanelPage.na')}
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <select
                          value={rowEdits.role}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], role: e.target.value } }))}
                          className="input-base"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>

                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={!!rowEdits.referralAdmin}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [u.id]: { ...prev[u.id], referralAdmin: e.target.checked },
                              }))
                            }
                          />
                          Referral admin access
                        </label>

                        <input
                          value={rowEdits.amazonLookupRequestLimitPerWeek}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], amazonLookupRequestLimitPerWeek: e.target.value } }))}
                          className="input-base"
                          placeholder="Amazon / week"
                          type="number"
                          min="0"
                        />

                        <input
                          value={rowEdits.productsLimit}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], productsLimit: e.target.value } }))}
                          className="input-base sm:col-span-2"
                          placeholder="Products limit"
                          type="number"
                          min="0"
                        />

                        <input
                          value={rowEdits.marketAnalysisCreditsLimit}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], marketAnalysisCreditsLimit: e.target.value } }))}
                          className="input-base sm:col-span-2"
                          placeholder="Checkila Analysis credits limit"
                          type="number"
                          min="0"
                        />

                        <input
                          value={rowEdits.ebayAccountsLimit}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], ebayAccountsLimit: e.target.value } }))}
                          className="input-base sm:col-span-2"
                          placeholder="eBay accounts limit"
                          type="number"
                          min="0"
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!resetUsage[u.id]}
                              onChange={(e) => setResetUsage((prev) => ({ ...prev, [u.id]: e.target.checked }))}
                            />
                            {t('adminPanelPage.resetAmazonUsageNow')}
                          </label>
                          <label className="text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!resetUsage[`${u.id}__marketAnalysis`]}
                              onChange={(e) =>
                                setResetUsage((prev) => ({
                                  ...prev,
                                  [`${u.id}__marketAnalysis`]: e.target.checked,
                                }))
                              }
                            />
                            {t('adminPanelPage.resetCheckilaAnalysisCreditsUsageNow')}
                          </label>
                          <label className="text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!rowEdits.isUntouched}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [u.id]: { ...prev[u.id], isUntouched: e.target.checked },
                                }))
                              }
                            />
                            <span className="font-semibold text-purple-600">{t('adminPanelPage.untouched')}</span>
                            <span className="text-slate-400">({t('adminPanelPage.unlimitedIps')})</span>
                          </label>
                          <label className="text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!rowEdits.isIt6HourChecker}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [u.id]: { ...prev[u.id], isIt6HourChecker: e.target.checked },
                                }))
                              }
                            />
                            <Clock3 size={12} className="text-amber-500" />
                            <span className="font-semibold text-amber-600">6-hour Amazon checker</span>
                          </label>
                        </div>

                        <button type="button" onClick={() => onSaveLimits(u.id)} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
                          <Pencil size={14} /> {t('adminPanelPage.save')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'requests' && (
          <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
            <div className="flex items-center gap-2 mb-4">
              <ListChecks size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {t('adminPanelPage.requests')} ({pendingRequests.length} {t('adminPanelPage.pending')})
              </h2>
            </div>

            {requests.length === 0 ? (
              <p className="text-sm text-slate-500">{t('adminPanelPage.noRequestsFound')}</p>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => {
                  const action = requestAction[req.id] || {};
                  const isPending = (req.status || 'pending') === 'pending';
                  const requestTypeLabel = formatRequestTypeLabel(req.requestType);
                  const planCategoryLabel = formatPlanCategory(req.planCategory);

                  return (
                    <div key={req.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{req.name} {req.surname}</p>
                          <p className="text-xs text-slate-500">{req.email} • {req.phoneNumber}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isPending ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {req.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {req.requestType === 'subscription' ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {planCategoryLabel}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {requestTypeLabel}
                          </span>
                        )}
                        {req.requestType === 'subscription' ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                            {requestTypeLabel}
                          </span>
                        ) : null}
                        {req.requestType === 'update_credits' && req.requestedCredits != null ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                            {t('adminPanelPage.credits')}: {req.requestedCredits}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-xs text-slate-500">{t('adminPanelPage.plan')}: {req.planName || t('adminPanelPage.na')}{req.requestType === 'subscription' ? ` (${planCategoryLabel})` : ''}</p>
                      {(req.planId === 'custom' || req.planCategory === 'custom') ? (
                        <div className="mt-2 rounded-lg border border-cyan-200 bg-cyan-50/70 p-2 text-xs text-slate-700 dark:border-cyan-900/40 dark:bg-cyan-900/20 dark:text-cyan-100">
                          <p className="font-semibold">{t('adminPanelPage.customRequestedLimits')}</p>
                          <p className="mt-1">
                            {t('adminPanelPage.amazonPerWeek')}: {req.requestedLimits?.amazonLookupLimitPerWeek ?? t('adminPanelPage.na')} | {t('adminPanelPage.products')}: {req.requestedLimits?.productsLimit ?? t('adminPanelPage.na')} | {t('adminPanelPage.checkilaAnalysisCredits')}: {req.requestedLimits?.marketAnalysisCreditsLimit ?? t('adminPanelPage.na')} | {t('adminPanelPage.ebayAccounts')}: {req.requestedLimits?.ebayAccountsLimit ?? t('adminPanelPage.na')}
                          </p>
                          {req.customNote ? <p className="mt-1">{t('adminPanelPage.note')}: {req.customNote}</p> : null}
                        </div>
                      ) : null}

                      {isPending ? (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                          <input
                            type="text"
                            placeholder={t('adminPanelPage.adminNoteOptional')}
                            value={action.adminNote || ''}
                            onChange={(e) => setRequestAction((prev) => ({ ...prev, [req.id]: { ...prev[req.id], adminNote: e.target.value } }))}
                            className="input-base"
                          />
                          <button type="button" onClick={() => onApproveRequest(req.id)} className="btn-primary px-4 py-2">{t('adminPanelPage.approve')}</button>
                          <button type="button" onClick={() => onRejectRequest(req.id)} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">{t('adminPanelPage.reject')}</button>
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-slate-500">
                          {req.status === 'approved' ? t('adminPanelPage.approvedBy', { name: req.approvedBy || 'admin' }) : t('adminPanelPage.rejectedBy', { name: req.rejectedBy || 'admin' })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'plans' && (
          <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 lg:gap-6">
            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <PackageOpen size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {planForm.id ? t('adminPanelPage.editPlan') : t('adminPanelPage.createPlan')}
                </h2>
              </div>

              <form onSubmit={onSavePlan} className="space-y-3">
                <input value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.planName')} type="text" />

                <div className="grid grid-cols-2 gap-3">
                  <select value={planForm.category} onChange={(e) => setPlanForm((p) => ({ ...p, category: e.target.value }))} className="input-base">
                    <option value="subscription">{t('adminPanelPage.subscription')}</option>
                    <option value="analytics">{t('adminPanelPage.analytics')}</option>
                    <option value="amazon_monitoring">{t('adminPanelPage.amazonMonitoring')}</option>
                  </select>
                  <input value={planForm.price} onChange={(e) => setPlanForm((p) => ({ ...p, price: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.price')} type="text" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <input
                    value={planForm.actualPrice}
                    onChange={(e) => setPlanForm((p) => ({ ...p, actualPrice: e.target.value }))}
                    className="input-base"
                    placeholder={t('adminPanelPage.actualPrice')}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                  <input
                    value={planForm.discountedPrice}
                    onChange={(e) => setPlanForm((p) => ({ ...p, discountedPrice: e.target.value }))}
                    className="input-base"
                    placeholder={t('adminPanelPage.discountedPrice')}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                  <input
                    value={planForm.currency}
                    onChange={(e) => setPlanForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                    className="input-base"
                    placeholder={t('adminPanelPage.currency')}
                    type="text"
                  />
                </div>

                <input value={planForm.duration} onChange={(e) => setPlanForm((p) => ({ ...p, duration: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.duration')} type="text" />
                <textarea value={planForm.description} onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))} className="input-base min-h-[88px]" placeholder={t('adminPanelPage.description')} />
                <textarea value={planForm.featuresText} onChange={(e) => setPlanForm((p) => ({ ...p, featuresText: e.target.value }))} className="input-base min-h-[110px]" placeholder={t('adminPanelPage.featuresOnePerLine')} />

                <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-sm font-semibold mb-2">{t('adminPanelPage.visibleTabsForThisPlan')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAN_TAB_KEYS.map((tabKey) => {
                      const checked = planForm.allowedTabs.includes(tabKey);
                      return (
                        <label key={tabKey} className="text-xs flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setPlanForm((prev) => ({
                                ...prev,
                                allowedTabs: e.target.checked
                                  ? Array.from(new Set([...prev.allowedTabs, tabKey]))
                                  : prev.allowedTabs.filter((item) => item !== tabKey),
                              }))
                            }
                          />
                          {t(`adminPanelPage.planTabs.${tabKey}`)}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{t('adminPanelPage.dashboardAlwaysVisible')}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input value={planForm.amazonLookupLimitPerWeek} onChange={(e) => setPlanForm((p) => ({ ...p, amazonLookupLimitPerWeek: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.amazonPerWeek')} type="number" min="0" />
                  <input value={planForm.productsLimit} onChange={(e) => setPlanForm((p) => ({ ...p, productsLimit: e.target.value }))} className="input-base" placeholder={t('adminPanelPage.products')} type="number" min="0" />
                </div>
                <input
                  value={planForm.marketAnalysisCreditsLimit}
                  onChange={(e) => setPlanForm((p) => ({ ...p, marketAnalysisCreditsLimit: e.target.value }))}
                  className="input-base"
                  placeholder={t('adminPanelPage.checkilaAnalysisCredits')}
                  type="number"
                  min="0"
                />
                <input
                  value={planForm.ebayAccountsLimit}
                  onChange={(e) => setPlanForm((p) => ({ ...p, ebayAccountsLimit: e.target.value }))}
                  className="input-base"
                  placeholder={t('adminPanelPage.ebayAccountsLimit')}
                  type="number"
                  min="0"
                />

                <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={planForm.featured} onChange={(e) => setPlanForm((p) => ({ ...p, featured: e.target.checked }))} /> {t('adminPanelPage.featured')}</label>
                <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={planForm.isActive} onChange={(e) => setPlanForm((p) => ({ ...p, isActive: e.target.checked }))} /> {t('adminPanelPage.active')}</label>

                <button type="submit" className="btn-primary w-full py-2.5">{t('adminPanelPage.savePlan')}</button>
                {planForm.id ? (
                  <button type="button" onClick={() => setPlanForm(defaultPlanForm())} className="btn-secondary w-full py-2.5">
                    {t('adminPanelPage.cancelEdit')}
                  </button>
                ) : null}
              </form>
            </div>

            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <PackageOpen size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('adminPanelPage.plans')}</h2>
              </div>

              <div className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{plan.name}</p>
                        <p className="text-xs text-slate-500">{plan.category} • {plan.price || t('adminPanelPage.noPrice')} • {plan.duration || t('adminPanelPage.noDuration')}</p>
                        <p className="text-xs text-slate-500">{t('adminPanelPage.pricing')}: {plan.actualPrice ?? '-'} → {plan.discountedPrice ?? '-'} {plan.currency || 'AZN'}</p>
                        <p className="text-xs text-slate-500">Stripe Product: {plan.stripeProductId || '-'}</p>
                        <p className="text-xs text-slate-500">Stripe Monthly Price: {plan.stripePriceIdMonthly || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">{t('adminPanelPage.amazonPerWeek')}: {plan.amazonLookupLimitPerWeek ?? t('adminPanelPage.unlimited')} | {t('adminPanelPage.products')}: {plan.productsLimit ?? t('adminPanelPage.unlimited')} | {t('adminPanelPage.checkilaAnalysisCredits')}: {plan.marketAnalysisCreditsLimit ?? t('adminPanelPage.unlimited')} | {t('adminPanelPage.ebayAccounts')}: {plan.ebayAccountsLimit ?? t('adminPanelPage.unlimited')}</p>
                        <p className="mt-1 text-xs text-slate-500">{t('adminPanelPage.visibleTabs')}: {Array.isArray(plan.allowedTabs) ? plan.allowedTabs.map((key) => t(`adminPanelPage.planTabs.${key}`)).join(', ') : t('adminPanelPage.allDefaultTabs')}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => onSyncPlanToStripe(plan.id)}>
                          Sync Stripe
                        </button>
                        <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => startEditPlan(plan)}>
                          {t('adminPanelPage.edit')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'partners' && (
          <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
            <PartnersManagement />
          </div>
        )}

        {!loading && activeTab === 'zik-accounts' && (
          <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
            <ZikAccounts />
          </div>
        )}

        {!loading && activeTab === 'notifications' && (
          <NotificationsTab
            isDark={isDark}
            notifForm={notifForm}
            setNotifForm={setNotifForm}
            notifSending={notifSending}
            onSendNotification={onSendNotification}
            notifHistory={notifHistory}
          />
        )}

        {!loading && activeTab === 'maintenance' && (
          <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 lg:gap-6">
            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  Schedule maintenance
                </h2>
              </div>

                <div className="mb-4">
                  <div className={`rounded-xl border p-3 mb-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500">Manual maintenance</p>
                        <p className="font-semibold">{maintenanceFlag.active ? 'Active' : 'Passive'} {maintenanceFlag.source ? `· ${maintenanceFlag.source}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5"
                          onClick={() => onSetMaintenanceFlag(true)}
                          disabled={maintenanceSubmitting}
                        >
                          Set Active
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-3 py-1.5"
                          onClick={() => onSetMaintenanceFlag(false)}
                          disabled={maintenanceSubmitting}
                        >
                          Set Passive
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Manual passive persists until an admin changes it. Cron will not clear a manual setting.</p>
                  </div>
                </div>

              <form onSubmit={onCreateMaintenance} className="space-y-3">
                <input
                  value={maintenanceForm.title}
                  onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="input-base"
                  placeholder="Title"
                  type="text"
                  maxLength={200}
                  disabled={maintenanceSubmitting}
                />
                <textarea
                  value={maintenanceForm.message}
                  onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, message: e.target.value }))}
                  className="input-base min-h-[150px]"
                  placeholder="Message shown to users"
                  maxLength={5000}
                  disabled={maintenanceSubmitting}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Start time</label>
                    <input
                      type="datetime-local"
                      value={maintenanceForm.startAt}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, startAt: e.target.value }))}
                      className="input-base"
                      disabled={maintenanceSubmitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">End time</label>
                    <input
                      type="datetime-local"
                      value={maintenanceForm.endAt}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, endAt: e.target.value }))}
                      className="input-base"
                      disabled={maintenanceSubmitting}
                    />
                  </div>
                </div>

                <div className={`rounded-xl border p-3 text-xs ${isDark ? 'border-blue-900 bg-blue-950/20 text-blue-100' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
                  Non-admin users will be blocked from login and protected requests while the window is active. An email announcement is sent automatically.
                </div>

                <button
                  type="submit"
                  disabled={maintenanceSubmitting}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {maintenanceSubmitting ? 'Creating...' : 'Create maintenance window'}
                </button>
              </form>
            </div>

            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  Maintenance history
                </h2>
              </div>

              <div className="space-y-3">
                {maintenanceWindows.length === 0 ? (
                  <p className="text-sm text-slate-500">No maintenance windows created yet.</p>
                ) : (
                  maintenanceWindows.map((window) => {
                    const isActive = window.isActive;
                    const badgeClass = isActive
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-100'
                      : new Date(window.startAt || 0).getTime() > Date.now()
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-100'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100';

                    return (
                      <div key={window.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{window.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{window.message}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                            {isActive ? 'active' : new Date(window.startAt || 0).getTime() > Date.now() ? 'scheduled' : 'finished'}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span><Clock3 size={12} className="mr-1 inline-block" />{formatMaintenanceTime(window.startAt)} (UTC+4)</span>
                          <span>Ends: {formatMaintenanceTime(window.endAt)} (UTC+4)</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Sent to {window.successCount || 0}/{window.recipientCount || 0} users, {window.errorCount || 0} failed.
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'referrals' && (
          <div className="space-y-4">
            <ReferralManagementTab />
          </div>
        )}

        {!loading && activeTab === 'stripe-webhooks' && (
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 lg:gap-6">
            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Webhook Events
              </h2>

              <div className="space-y-2 mb-3">
                <input
                  value={stripeWebhookFilters.eventType}
                  onChange={(e) => setStripeWebhookFilters((prev) => ({ ...prev, eventType: e.target.value }))}
                  className="input-base"
                  placeholder="Event type (optional)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={stripeWebhookFilters.processed}
                    onChange={(e) => setStripeWebhookFilters((prev) => ({ ...prev, processed: e.target.value }))}
                    className="input-base"
                  >
                    <option value="all">All</option>
                    <option value="true">Processed</option>
                    <option value="false">Unprocessed</option>
                  </select>
                  <select
                    value={stripeWebhookFilters.limit}
                    onChange={(e) => setStripeWebhookFilters((prev) => ({ ...prev, limit: Number(e.target.value) || 50 }))}
                    className="input-base"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-primary w-full py-2 inline-flex items-center justify-center gap-2"
                  onClick={() => loadStripeWebhooks(stripeWebhookFilters)}
                  disabled={stripeWebhookLoading}
                >
                  <RefreshCw size={14} /> {stripeWebhookLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                {stripeWebhookEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">No Stripe webhook events found.</p>
                ) : (
                  stripeWebhookEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => loadStripeWebhookDetail(event.id)}
                      className={`w-full rounded-xl border p-3 text-left ${
                        stripeWebhookSelected?.id === event.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : isDark
                            ? 'border-slate-700 bg-slate-950'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="text-xs font-semibold break-all">{event.eventType}</p>
                      <p className="text-xs text-slate-500 break-all mt-1">{event.eventId}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {event.createdAt ? new Date(event.createdAt).toLocaleString() : 'n/a'}
                        </span>
                        <span className={`text-[11px] font-semibold ${event.processedAt ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {event.processedAt ? 'processed' : 'pending'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Event Details
              </h2>

              {stripeWebhookDetailLoading ? (
                <p className="text-sm text-slate-500">Loading event details...</p>
              ) : !stripeWebhookSelected ? (
                <p className="text-sm text-slate-500">Select an event to inspect payload.</p>
              ) : (
                <>
                  <div className="mb-3 space-y-1 text-sm">
                    <p><span className="font-semibold">Type:</span> {stripeWebhookSelected.eventType}</p>
                    <p className="break-all"><span className="font-semibold">Event ID:</span> {stripeWebhookSelected.eventId}</p>
                    <p><span className="font-semibold">Created:</span> {stripeWebhookSelected.createdAt ? new Date(stripeWebhookSelected.createdAt).toLocaleString() : 'n/a'}</p>
                    <p><span className="font-semibold">Processed:</span> {stripeWebhookSelected.processedAt ? new Date(stripeWebhookSelected.processedAt).toLocaleString() : 'not processed'}</p>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary mb-3 px-3 py-2"
                    disabled={stripeWebhookReprocessingId === stripeWebhookSelected.id}
                    onClick={() => onReprocessStripeWebhook(stripeWebhookSelected.id)}
                  >
                    {stripeWebhookReprocessingId === stripeWebhookSelected.id ? 'Reprocessing...' : 'Reprocess event'}
                  </button>

                  <pre className={`max-h-[460px] overflow-auto rounded-xl border p-3 text-xs ${isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
{JSON.stringify(stripeWebhookSelected.payload || {}, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </div>
        )}

        {!loading && activeTab === 'danger' && (
          <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-red-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {t('adminPanelPage.dangerZone')}
              </h2>
            </div>

            <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t('adminPanelPage.dangerZoneDescription')}
            </p>

            <div className={`rounded-xl border p-4 ${isDark ? 'border-red-900 bg-red-950/20' : 'border-red-200 bg-red-50'}`}>
              <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-red-200' : 'text-red-700'}`}>
                {t('adminPanelPage.deleteSearchRecords')}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <select
                    value={dangerWindow}
                    onChange={(e) => setDangerWindow(e.target.value)}
                    className="input-base"
                  >
                    <option value="3d">{t('adminPanelPage.within3Days')}</option>
                    <option value="7d">{t('adminPanelPage.within7Days')}</option>
                    <option value="1m">{t('adminPanelPage.within1Month')}</option>
                    <option value="1y">{t('adminPanelPage.within1Year')}</option>
                    <option value="all">{t('adminPanelPage.all')}</option>
                  </select>
                  <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('adminPanelPage.deletesMatchingRowsFrom')} <span className="font-semibold">ebay_search_cache</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onPurgeSearchCache}
                  disabled={dangerSubmitting}
                  className="rounded-lg border border-red-600 bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {dangerSubmitting ? t('adminPanelPage.deleting') : t('adminPanelPage.deleteSearchData')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
