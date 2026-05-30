import React, { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';

export default function ZikAccounts() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ email: '', password: '' });
  const [editingId, setEditingId] = useState(null);
  const [alert, setAlert] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.listZikAccounts();
      setAccounts(res?.data?.accounts || []);
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to load accounts' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    try {
      setLoading(true);
      if (editingId) {
        await adminAPI.updateZikAccount(editingId, { email: form.email, password: form.password || undefined });
      } else {
        await adminAPI.createZikAccount({ email: form.email, password: form.password });
      }
      setForm({ email: '', password: '' });
      setEditingId(null);
      await load();
      setAlert({ type: 'success', message: 'Saved' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to save' });
    } finally {
      setLoading(false);
    }
  };

  const onEdit = (a) => {
    setEditingId(a.id);
    setForm({ email: a.email, password: '' });
  };

  const onDelete = async (id) => {
    if (!confirm('Delete this Zik account?')) return;
    try {
      setLoading(true);
      await adminAPI.deleteZikAccount(id);
      await load();
      setAlert({ type: 'success', message: 'Deleted' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to delete' });
    } finally {
      setLoading(false);
    }
  };

  const onSetActive = async (id) => {
    try {
      setLoading(true);
      await adminAPI.setActiveZikAccount(id);
      await load();
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to set active' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Zik Accounts</h3>
      {alert && <div className={`p-2 mb-2 ${alert.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{alert.message}</div>}

      <form onSubmit={onSubmit} className="mb-4">
        <div className="grid grid-cols-3 gap-2">
          <input className="p-2 border" placeholder="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="p-2 border" placeholder="password (leave blank to keep)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div>
            <button type="submit" className="px-3 py-2 bg-blue-600 text-white mr-2">{editingId ? 'Save' : 'Add'}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ email: '', password: '' }); }} className="px-3 py-2">Cancel</button>}
          </div>
        </div>
      </form>

      <div>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <table className="min-w-full border">
            <thead>
              <tr className="bg-slate-100"><th className="p-2">Email</th><th className="p-2">Active</th><th className="p-2">Actions</th></tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{a.email}</td>
                  <td className="p-2">{a.isActive ? 'Yes' : 'No'}</td>
                  <td className="p-2">
                    <button onClick={() => onEdit(a)} className="mr-2 px-2 py-1 border">Edit</button>
                    <button onClick={() => onDelete(a.id)} className="mr-2 px-2 py-1 border">Delete</button>
                    {!a.isActive && <button onClick={() => onSetActive(a.id)} className="px-2 py-1 bg-green-600 text-white">Set Active</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
