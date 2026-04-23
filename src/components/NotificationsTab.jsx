// ─────────────────────────────────────────────────────────────
// 1. Add to your adminAPI in api.js:
// ─────────────────────────────────────────────────────────────
/*
  sendNotification: (data) => api.post('/admin/notifications/send', data),
  listNotifications: () => api.get('/admin/notifications'),
*/

// ─────────────────────────────────────────────────────────────
// 2. Add state inside AdminPanelPage component:
// ─────────────────────────────────────────────────────────────
/*
  const [notifForm, setNotifForm] = useState({ header: '', message: '' });
  const [notifHistory, setNotifHistory] = useState([]);
  const [notifSending, setNotifSending] = useState(false);
*/

// ─────────────────────────────────────────────────────────────
// 3. Add to refreshData():
// ─────────────────────────────────────────────────────────────
/*
  const [usersRes, plansRes, requestsRes, notifRes] = await Promise.all([
    adminAPI.listUsers(),
    adminAPI.listPlans(),
    adminAPI.listSubscriptionRequests(),
    adminAPI.listNotifications(),
  ]);
  setNotifHistory(notifRes?.data?.notifications || []);
*/

// ─────────────────────────────────────────────────────────────
// 4. Add handler inside AdminPanelPage:
// ─────────────────────────────────────────────────────────────
/*
  const onSendNotification = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (!notifForm.header.trim()) {
      setAlert({ type: 'warning', message: 'Notification header is required' });
      return;
    }
    if (!notifForm.message.trim()) {
      setAlert({ type: 'warning', message: 'Notification message is required' });
      return;
    }
    try {
      setNotifSending(true);
      const res = await adminAPI.sendNotification({
        header: notifForm.header.trim(),
        message: notifForm.message.trim(),
      });
      setNotifForm({ header: '', message: '' });
      setAlert({ type: 'success', message: res?.data?.message || 'Notification queued successfully' });
      // Refresh history after a short delay to allow DB write
      setTimeout(() => refreshData(), 1500);
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to send notification' });
    } finally {
      setNotifSending(false);
    }
  };
*/

// ─────────────────────────────────────────────────────────────
// 5. Add tab button (next to Partners button in your tab bar):
// ─────────────────────────────────────────────────────────────
/*
  <button
    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'notifications' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
    onClick={() => setActiveTab('notifications')}
  >
    Notifications
  </button>
*/

// ─────────────────────────────────────────────────────────────
// 6. Add this tab panel (after the partners tab panel):
// ─────────────────────────────────────────────────────────────

export function NotificationsTab({ isDark, notifForm, setNotifForm, notifSending, onSendNotification, notifHistory }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 lg:gap-6">
      {/* Send Form */}
      <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            Send Notification to All Users
          </h2>
        </div>

        <form onSubmit={onSendNotification} className="space-y-3">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Header / Subject
            </label>
            <input
              value={notifForm.header}
              onChange={(e) => setNotifForm((p) => ({ ...p, header: e.target.value }))}
              className="input-base"
              placeholder="e.g. Important update from Checkila"
              type="text"
              maxLength={200}
              disabled={notifSending}
            />
            <p className="mt-1 text-xs text-slate-400">{notifForm.header.length}/200</p>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Message
            </label>
            <textarea
              value={notifForm.message}
              onChange={(e) => setNotifForm((p) => ({ ...p, message: e.target.value }))}
              className="input-base min-h-[180px]"
              placeholder="Write your message here. Line breaks are preserved."
              maxLength={5000}
              disabled={notifSending}
            />
            <p className="mt-1 text-xs text-slate-400">{notifForm.message.length}/5000</p>
          </div>

          <div className={`rounded-xl border p-3 text-xs ${isDark ? 'border-amber-800 bg-amber-950/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            ⚠️ This will send an email to <strong>all registered users</strong>. The email is sent in the background — you can navigate away after submitting.
          </div>

          <button
            type="submit"
            disabled={notifSending || !notifForm.header.trim() || !notifForm.message.trim()}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {notifSending ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Queuing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Send to all users
              </>
            )}
          </button>
        </form>
      </div>

      {/* History */}
      <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            Notification History
          </h2>
        </div>

        {notifHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications sent yet.</p>
        ) : (
          <div className="space-y-3">
            {notifHistory.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{n.header}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    n.status === 'sent'
                      ? 'bg-emerald-100 text-emerald-700'
                      : n.status === 'sending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {n.status}
                  </span>
                </div>

                <p className={`mt-1 text-xs line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {n.message}
                </p>

                <div className={`mt-2 flex flex-wrap gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>📨 Recipients: <strong>{n.recipientCount}</strong></span>
                  <span>✅ Sent: <strong>{n.successCount}</strong></span>
                  {n.errorCount > 0 && (
                    <span className="text-red-500">❌ Failed: <strong>{n.errorCount}</strong></span>
                  )}
                  <span>By: {n.sentBy}</span>
                  <span>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
