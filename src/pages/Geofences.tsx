/**
 * ARQUIVO: src/pages/Geofences.tsx
 * O QUE FAZ: cadastro de cercas eletrônicas (zona circular: centro + raio) por veículo,
 *   pelo gestor (Admin/Root).
 * PARA QUE SERVE: Rodada C / C2 — pré-requisito de dados pra GeofenceRule (ainda um
 *   stub, pendente do formato real do webhook da SmartGPS — ver
 *   src/lib/alerts/GeofenceRule.ts). O cadastro em si não depende disso: é só dado que o
 *   gestor informa, sem cálculo de geofence local.
 * MÓDULOS RELACIONADOS:
 *   - supabase/migrations/20260916000005_alert_engine.sql — tabela geofences
 *   - src/lib/alerts/GeofenceRule.ts — consumidor futuro deste cadastro
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C2)
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, Edit2, Trash2, X, Loader2, Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Vehicle } from '../types';
import { supabase } from '../lib/supabase';

interface Geofence {
  id: string;
  vehicleId: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  active: boolean;
}

const normalize = (r: Record<string, unknown>): Geofence => ({
  id: r.id as string,
  vehicleId: r.vehicle_id as string,
  name: r.name as string,
  centerLat: r.center_lat as number,
  centerLng: r.center_lng as number,
  radiusMeters: r.radius_meters as number,
  active: r.active as boolean,
});

interface FormData {
  vehicleId: string;
  name: string;
  centerLat: string;
  centerLng: string;
  radiusMeters: string;
}

const defaultForm: FormData = { vehicleId: '', name: '', centerLat: '', centerLng: '', radiusMeters: '500' };

export default function Geofences() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Geofence | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<Geofence | null>(null);

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (!userJson) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userJson);
    if (user.role !== 'Admin' && user.role !== 'Root') {
      navigate('/daily-report');
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: vehicleData }, { data: geofenceData }] = await Promise.all([
      supabase.from('vehicles').select('*').order('plate'),
      supabase.from('geofences').select('*').order('name'),
    ]);
    setVehicles((vehicleData ?? []) as Vehicle[]);
    setGeofences((geofenceData ?? []).map(normalize));
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setFormData(defaultForm);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (g: Geofence) => {
    setEditing(g);
    setFormData({
      vehicleId: g.vehicleId,
      name: g.name,
      centerLat: String(g.centerLat),
      centerLng: String(g.centerLng),
      radiusMeters: String(g.radiusMeters),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const lat = Number(formData.centerLat);
    const lng = Number(formData.centerLng);
    const radius = Number(formData.radiusMeters);

    if (!formData.vehicleId || !formData.name.trim()) {
      setFormError('Selecione o veículo e informe um nome para a cerca.');
      return;
    }
    if (Number.isNaN(lat) || lat < -90 || lat > 90 || Number.isNaN(lng) || lng < -180 || lng > 180) {
      setFormError('Latitude/longitude inválidas.');
      return;
    }
    if (Number.isNaN(radius) || radius <= 0) {
      setFormError('Raio deve ser maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vehicle_id: formData.vehicleId,
        name: formData.name.trim(),
        center_lat: lat,
        center_lng: lng,
        radius_meters: Math.round(radius),
      };

      const { error } = editing
        ? await supabase.from('geofences').update(payload).eq('id', editing.id)
        : await supabase.from('geofences').insert([payload]);

      if (error) throw error;

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar cerca.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await supabase.from('geofences').delete().eq('id', deleting.id);
    setDeleting(null);
    await loadData();
  };

  const vehicleLabel = (vehicleId: string) => {
    const v = vehicles.find((veh) => veh.id === vehicleId);
    return v ? `${v.plate} - ${v.model}` : '—';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 flex flex-col overflow-auto">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold dark:text-white">Cercas Eletrônicas</h2>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nova Cerca</span>
          </button>
        </header>

        <div className="p-4 md:p-8 space-y-6">
          <div className="card overflow-hidden border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">Veículo</th>
                    <th className="px-6 py-4 text-center">Centro</th>
                    <th className="px-6 py-4 text-center">Raio (m)</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : geofences.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <MapPin className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                        Nenhuma cerca cadastrada ainda.
                      </td>
                    </tr>
                  ) : (
                    geofences.map((g) => (
                      <tr key={g.id}>
                        <td className="px-6 py-4 font-medium dark:text-white">{g.name}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{vehicleLabel(g.vehicleId)}</td>
                        <td className="px-6 py-4 text-center text-slate-500 text-sm">
                          {g.centerLat.toFixed(5)}, {g.centerLng.toFixed(5)}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500">{g.radiusMeters}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openEdit(g)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/10">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => setDeleting(g)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editing ? 'Editar Cerca' : 'Nova Cerca'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Veículo</label>
                  <select required className="input-field" value={formData.vehicleId} onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}>
                    <option value="">Selecione</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome da Cerca</label>
                  <input required className="input-field" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Latitude</label>
                    <input required type="number" step="any" className="input-field" value={formData.centerLat} onChange={(e) => setFormData({ ...formData, centerLat: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Longitude</label>
                    <input required type="number" step="any" className="input-field" value={formData.centerLng} onChange={(e) => setFormData({ ...formData, centerLng: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Raio (metros)</label>
                  <input required type="number" min="1" className="input-field" value={formData.radiusMeters} onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })} />
                </div>
                {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4 text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Excluir cerca "{deleting.name}"?</h3>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400">Cancelar</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700">Excluir</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
