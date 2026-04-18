import React, { useEffect, useRef, useState } from 'react';
import { partnerAPI } from '../services/api';
import Alert from './Alert';
import LoadingSpinner from './LoadingSpinner';
import { Trash2, Edit2, Plus, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function PartnersManagement() {
  const { isDark } = useTheme();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', display_order: 0 });
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load partners
  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      setLoading(true);
      const res = await partnerAPI.getAll();
      setPartners(res.data.data || []);
      setAlert(null);
    } catch (error) {
      console.error('Error loading partners:', error);
      setAlert({ type: 'error', message: 'Failed to load partners' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', display_order: 0 });
    setSelectedFile(null);
    setEditingId(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEdit = (partner) => {
    setEditingId(partner.id);
    setFormData({
      name: partner.name,
      display_order: partner.display_order || 0,
    });
    setShowForm(true);
    setSelectedFile(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setAlert({ type: 'error', message: 'File size must be less than 5MB' });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setAlert({ type: 'error', message: 'Partner name is required' });
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        name: formData.name.trim(),
        display_order: Number(formData.display_order) || 0,
        ...(selectedFile && { logo: selectedFile }),
      };

      if (editingId) {
        await partnerAPI.update(editingId, data);
        setAlert({ type: 'success', message: 'Partner updated successfully' });
      } else {
        await partnerAPI.create(data);
        setAlert({ type: 'success', message: 'Partner created successfully' });
      }

      resetForm();
      await loadPartners();
    } catch (error) {
      console.error('Error saving partner:', error);
      setAlert({
        type: 'error',
        message: error?.response?.data?.error || 'Failed to save partner',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this partner?')) return;

    try {
      await partnerAPI.delete(id);
      setAlert({ type: 'success', message: 'Partner deleted successfully' });
      await loadPartners();
    } catch (error) {
      console.error('Error deleting partner:', error);
      setAlert({ type: 'error', message: 'Failed to delete partner' });
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await partnerAPI.toggleStatus(id, currentStatus === 1 ? 0 : 1);
      await loadPartners();
    } catch (error) {
      console.error('Error toggling partner status:', error);
      setAlert({ type: 'error', message: 'Failed to toggle partner status' });
    }
  };

  if (loading) return <LoadingSpinner />;

  const bgClass = isDark ? 'bg-slate-900' : 'bg-white';
  const borderClass = isDark ? 'border-slate-700' : 'border-gray-200';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const secondaryTextClass = isDark ? 'text-slate-400' : 'text-gray-600';
  const hoverClass = isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50';

  return (
    <div className="space-y-6">
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${textClass}`}>Partners Management</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-600 transition"
          >
            <Plus size={20} />
            Add Partner
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className={`rounded-lg border ${borderClass} ${bgClass} p-6`}>
          <h3 className={`mb-4 text-lg font-semibold ${textClass}`}>
            {editingId ? 'Edit Partner' : 'Create New Partner'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${textClass} mb-1`}>
                Partner Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border ${borderClass} ${isDark ? 'bg-slate-800 text-white' : 'bg-white'}`}
                placeholder="Enter partner name"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${textClass} mb-1`}>
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: Number(e.target.value) })
                }
                className={`w-full px-4 py-2 rounded-lg border ${borderClass} ${isDark ? 'bg-slate-800 text-white' : 'bg-white'}`}
                placeholder="0"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${textClass} mb-1`}>
                Logo {!editingId && '*'}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className={`w-full px-4 py-2 rounded-lg border ${borderClass} ${isDark ? 'bg-slate-800 text-white' : 'bg-white'}`}
              />
              {selectedFile && (
                <p className={`mt-1 text-sm ${secondaryTextClass}`}>
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-600 disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className={`flex-1 rounded-lg border ${borderClass} px-4 py-2 ${textClass} hover:${hoverClass} transition`}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Partners List */}
      <div className={`rounded-lg border ${borderClass} overflow-hidden`}>
        {partners.length === 0 ? (
          <div className={`p-8 text-center ${secondaryTextClass}`}>
            <p>No partners yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDark ? 'bg-slate-800' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-6 py-3 text-left text-sm font-semibold ${textClass}`}>
                    Logo
                  </th>
                  <th className={`px-6 py-3 text-left text-sm font-semibold ${textClass}`}>
                    Name
                  </th>
                  <th className={`px-6 py-3 text-left text-sm font-semibold ${textClass}`}>
                    Order
                  </th>
                  <th className={`px-6 py-3 text-left text-sm font-semibold ${textClass}`}>
                    Status
                  </th>
                  <th className={`px-6 py-3 text-left text-sm font-semibold ${textClass}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner, idx) => (
                  <tr
                    key={partner.id}
                    className={`border-t ${borderClass} ${idx % 2 === 1 ? (isDark ? 'bg-slate-800/50' : 'bg-gray-50') : ''} ${hoverClass} transition`}
                  >
                    <td className="px-6 py-4">
                      {partner.logo_url ? (
                        <img
                          src={partner.logo_url}
                          alt={partner.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className={`h-10 w-10 rounded ${isDark ? 'bg-slate-700' : 'bg-gray-300'}`} />
                      )}
                    </td>
                    <td className={`px-6 py-4 text-sm ${textClass}`}>{partner.name}</td>
                    <td className={`px-6 py-4 text-sm ${secondaryTextClass}`}>
                      {partner.display_order}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(partner.id, partner.is_active)}
                        className={`inline-flex items-center gap-1 rounded px-3 py-1 text-sm font-medium transition ${
                          partner.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {partner.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                        {partner.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(partner)}
                          className="rounded p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 transition"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(partner.id)}
                          className="rounded p-2 text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 transition"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
