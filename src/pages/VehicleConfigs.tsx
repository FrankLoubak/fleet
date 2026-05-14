import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings2,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  Menu,
  Settings,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { VehicleConfig } from '../types';
import { supabase } from '../lib/supabase';
import { getPositionsForAxle, buildPosition, buildReservaPosition } from '../utils/tirePositions';

// ─── helpers ────────────────────────────────────────────────────────────────

const normalize = (r: Record<string, unknown>): VehicleConfig => ({
  id: r.id as string,
  nome: r.nome as string,
  eixo1: r.eixo_1 as number,
  eixo2: r.eixo_2 as number | null,
  eixo3: r.eixo_3 as number | null,
  eixo4: r.eixo_4 as number | null,
  pneusReserva: r.pneus_reserva as number,
  createdAt: r.created_at as string,
});

function totalPneus(cfg: VehicleConfig): number {
  return (
    (cfg.eixo1 || 0) +
    (cfg.eixo2 || 0) +
    (cfg.eixo3 || 0) +
    (cfg.eixo4 || 0) +
    (cfg.pneusReserva || 0)
  );
}

function isEvenAndValid(val: number): boolean {
  return val >= 2 && val % 2 === 0;
}

// ─── types ───────────────────────────────────────────────────────────────────

interface FormData {
  nome: string;
  eixo1: number;
  eixo2: number | null;
  eixo3: number | null;
  eixo4: number | null;
  pneusReserva: number;
}

const defaultForm: FormData = {
  nome: '',
  eixo1: 2,
  eixo2: null,
  eixo3: null,
  eixo4: null,
  pneusReserva: 0,
};

// ─── live preview component ──────────────────────────────────────────────────

function AxlePreview({ form }: { form: FormData }) {
  const eixos: { label: string; count: number | null }[] = [
    { label: 'Eixo 1', count: form.eixo1 },
    { label: 'Eixo 2', count: form.eixo2 },
    { label: 'Eixo 3', count: form.eixo3 },
    { label: 'Eixo 4', count: form.eixo4 },
  ];

  const activeEixos = eixos.filter(
    (e) => e.count !== null && e.count >= 2
  );

  if (activeEixos.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
        Pré-visualização dos Eixos
      </p>
      <div className="space-y-3">
        {activeEixos.map((eixo, idx) => {
          const positions = getPositionsForAxle(eixo.count as number);
          const eixoIndex = idx + 1;
          return (
            <div key={eixoIndex} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 w-14 shrink-0">
                {eixo.label}
              </span>
              <div className="flex gap-1 flex-wrap">
                {positions.map((slot) => {
                  const posLabel = buildPosition(eixoIndex, slot);
                  return (
                    <div
                      key={posLabel}
                      className="px-2 py-1 bg-primary/10 text-primary border border-primary/30 rounded text-[10px] font-bold"
                      title={posLabel}
                    >
                      {slot}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {form.pneusReserva > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 w-14 shrink-0">
              Reserva
            </span>
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: form.pneusReserva }, (_, i) => {
                const pos = buildReservaPosition(i + 1);
                return (
                  <div
                    key={pos}
                    className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300/50 rounded text-[10px] font-bold"
                    title={pos}
                  >
                    R{i + 1}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function VehicleConfigs() {
  const navigate = useNavigate();

  const [configs, setConfigs] = useState<VehicleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<VehicleConfig | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  // delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<VehicleConfig | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ─── auth / role check ─────────────────────────────────────────────────────

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
  }, [navigate]);

  // ─── data load ─────────────────────────────────────────────────────────────

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicle_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs((data || []).map((r) => normalize(r as Record<string, unknown>)));
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  // ─── form helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingConfig(null);
    setFormData(defaultForm);
    setShowModal(true);
  };

  const openEdit = (cfg: VehicleConfig) => {
    setEditingConfig(cfg);
    setFormData({
      nome: cfg.nome,
      eixo1: cfg.eixo1,
      eixo2: cfg.eixo2 ?? null,
      eixo3: cfg.eixo3 ?? null,
      eixo4: cfg.eixo4 ?? null,
      pneusReserva: cfg.pneusReserva,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingConfig(null);
    setFormData(defaultForm);
  };

  const setEixoValue = (
    key: 'eixo2' | 'eixo3' | 'eixo4',
    raw: string
  ) => {
    if (raw === '') {
      setFormData((prev) => ({ ...prev, [key]: null }));
    } else {
      setFormData((prev) => ({ ...prev, [key]: Number(raw) }));
    }
  };

  // ─── validation & save ─────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      alert('Informe o nome da configuração.');
      return;
    }

    // Validate eixo1 always
    if (!isEvenAndValid(formData.eixo1)) {
      alert('Eixo deve ter número par de pneus (mínimo 2).');
      return;
    }

    // Validate optional eixos when filled
    for (const key of ['eixo2', 'eixo3', 'eixo4'] as const) {
      const val = formData[key];
      if (val !== null && val !== undefined) {
        if (!isEvenAndValid(val)) {
          alert('Eixo deve ter número par de pneus (mínimo 2).');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        nome: formData.nome.trim(),
        eixo_1: formData.eixo1,
        eixo_2: formData.eixo2 || null,
        eixo_3: formData.eixo3 || null,
        eixo_4: formData.eixo4 || null,
        pneus_reserva: formData.pneusReserva,
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('vehicle_configs')
          .update(payload)
          .eq('id', editingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehicle_configs')
          .insert(payload);
        if (error) throw error;
      }

      await loadConfigs();
      closeModal();
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // ─── delete ────────────────────────────────────────────────────────────────

  const openDelete = (cfg: VehicleConfig) => {
    setDeletingConfig(cfg);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingConfig(null);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deletingConfig) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      // Check if any vehicles use this config
      const { count, error: countError } = await supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('config_id', deletingConfig.id);

      if (countError) throw countError;

      if (count && count > 0) {
        setDeleteError(
          `Configuração em uso por ${count} veículo${count > 1 ? 's' : ''}. Desvincule antes de excluir.`
        );
        setDeleteLoading(false);
        return;
      }

      const { error } = await supabase
        .from('vehicle_configs')
        .delete()
        .eq('id', deletingConfig.id);

      if (error) throw error;

      await loadConfigs();
      closeDeleteModal();
    } catch (err) {
      console.error('Erro ao excluir configuração:', err);
      setDeleteError('Erro ao excluir. Tente novamente.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 flex flex-col overflow-auto">
        {/* ── Header ── */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold dark:text-white">
              Configurações de Veículos
            </h2>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nova Configuração</span>
          </button>
        </header>

        <div className="p-4 md:p-8 space-y-6">
          {/* ── Summary Card ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 bg-primary text-white border-none shadow-xl shadow-primary/20 overflow-hidden relative">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Settings2 size={20} />
                  </div>
                  <span className="text-sm font-medium text-white/80">
                    Total de Configurações
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold">{configs.length}</h3>
                  <span className="text-sm font-medium text-white/60">
                    cadastradas
                  </span>
                </div>
                <p className="mt-4 text-xs text-white/60 flex items-center gap-1">
                  <Settings size={12} />
                  <span>Configurações de eixo para frota</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="card overflow-hidden border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4 text-center">Eixo 1</th>
                    <th className="px-6 py-4 text-center">Eixo 2</th>
                    <th className="px-6 py-4 text-center">Eixo 3</th>
                    <th className="px-6 py-4 text-center">Eixo 4</th>
                    <th className="px-6 py-4 text-center">Reservas</th>
                    <th className="px-6 py-4 text-center">Total Pneus</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <p className="text-sm text-slate-500">
                            Carregando configurações...
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : configs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                            <Settings2 size={32} />
                          </div>
                          <p className="text-slate-500 font-medium">
                            Nenhuma configuração cadastrada
                          </p>
                          <button
                            onClick={openCreate}
                            className="text-sm text-primary font-semibold hover:underline"
                          >
                            Criar primeira configuração
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    configs.map((cfg) => (
                      <tr
                        key={cfg.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {cfg.nome}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {cfg.eixo1}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {cfg.eixo2 ?? '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {cfg.eixo3 ?? '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {cfg.eixo4 ?? '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {cfg.pneusReserva}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-bold">
                            {totalPneus(cfg)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(cfg)}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-primary"
                              title="Editar"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => openDelete(cfg)}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-slate-400 hover:text-red-500"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold dark:text-white">
                {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  placeholder="Ex.: Truck 6×2"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary dark:text-white"
                />
              </div>

              {/* Eixo 1 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Eixo 1 — nº de pneus <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={2}
                  max={8}
                  step={2}
                  value={formData.eixo1}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      eixo1: Number(e.target.value),
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary dark:text-white"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Deve ser par e entre 2 e 8.
                </p>
              </div>

              {/* Eixo 2 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Eixo 2 — nº de pneus{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="number"
                  min={2}
                  max={8}
                  step={2}
                  value={formData.eixo2 ?? ''}
                  onChange={(e) => setEixoValue('eixo2', e.target.value)}
                  placeholder="Deixe vazio para ignorar"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary dark:text-white"
                />
              </div>

              {/* Eixo 3 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Eixo 3 — nº de pneus{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="number"
                  min={2}
                  max={8}
                  step={2}
                  value={formData.eixo3 ?? ''}
                  onChange={(e) => setEixoValue('eixo3', e.target.value)}
                  placeholder="Deixe vazio para ignorar"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary dark:text-white"
                />
              </div>

              {/* Eixo 4 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Eixo 4 — nº de pneus{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="number"
                  min={2}
                  max={8}
                  step={2}
                  value={formData.eixo4 ?? ''}
                  onChange={(e) => setEixoValue('eixo4', e.target.value)}
                  placeholder="Deixe vazio para ignorar"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary dark:text-white"
                />
              </div>

              {/* Pneus Reserva */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pneus Reserva <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.pneusReserva}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      pneusReserva: Number(e.target.value),
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary dark:text-white"
                />
              </div>

              {/* Live Preview */}
              <AxlePreview form={formData} />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-blue-700 transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && deletingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold dark:text-white">
                Confirmar exclusão?
              </h3>
              <button
                onClick={closeDeleteModal}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Tem certeza que deseja excluir a configuração{' '}
                <span className="font-bold">"{deletingConfig.nome}"</span>?
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                Veículos que utilizam esta configuração perderão a referência de
                eixos e posições de pneu.
              </p>
              {deleteError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 font-medium">
                  {deleteError}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              {!deleteError && (
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-60"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Excluir</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
