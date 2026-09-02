'use client';

import { useState, useMemo, useId } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { useToast } from './Toast';
import { friendlyError } from '@/lib/friendlyError';
import { formatMoney } from '@/lib/formatMoney';
import { inputClass, labelClass, iconBtnClass } from './formStyles';
import { useDialog } from './useDialog';
import ConfirmDialog from './ConfirmDialog';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  stock_quantity: number | null;
  active: boolean;
};

// Reused for both adding and editing (see the editingId-gated render
// below) - same shell as ServicesManager's AddServiceModal, applied here
// too. Was: "Add product" expanded an inline form pushing every row below
// it down the page, and editing a product expanded THAT row itself into a
// big inline form doing the same thing - a real overlay for both instead.
function ProductModal({
  name,
  setName,
  description,
  setDescription,
  price,
  setPrice,
  stock,
  setStock,
  saving,
  error,
  onSubmit,
  onClose,
  title,
  submitLabel,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  stock: string;
  setStock: (v: string) => void;
  saving: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  title: string;
  submitLabel: string;
}) {
  const dialogRef = useDialog(true, onClose);
  const nameId = useId();
  const descriptionId = useId();
  const priceId = useId();
  const stockId = useId();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={dialogRef}
    >
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade"
        style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl bg-surface border-2 border-line shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] animate-rise">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display text-[19px] font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:bg-paper hover:text-ink transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor={nameId} className={labelClass}>Product name</label>
            <input
              id={nameId}
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Vitamin C Serum"
            />
          </div>
          <div>
            <label htmlFor={descriptionId} className={labelClass}>Description</label>
            <textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              rows={2}
              placeholder="Helps the AI match customer questions to this product - mention color, use-case, size etc."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={priceId} className={labelClass}>Price</label>
              <input
                id={priceId}
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor={stockId} className={labelClass}>Stock quantity</label>
              <input
                id={stockId}
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-accent px-5 py-3 text-body-sm font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ProductsManager({
  businessId,
  initialProducts,
}: {
  businessId: string;
  initialProducts: Product[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState('');
  const [editDraft, setEditDraft] = useState({ name: '', description: '', price: '', stock_quantity: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createBrowserSupabase();
  const showToast = useToast();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('products')
      .insert({
        business_id: businessId,
        name,
        description: description || null,
        price: price ? Number(price) : null,
        stock_quantity: stock ? Number(stock) : null,
      })
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      setError(friendlyError(insertError));
      return;
    }

    setProducts((prev) => [...prev, data]);
    setName('');
    setDescription('');
    setPrice('');
    setStock('');
    setShowAdd(false);
  }

  async function handleToggleActive(product: Product) {
    const { error: updateError } = await supabase
      .from('products')
      .update({ active: !product.active })
      .eq('id', product.id);

    if (!updateError) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, active: !p.active } : p))
      );
      showToast(product.active ? `${product.name} hidden from your booking page` : `${product.name} is visible again`);
    } else {
      showToast('Could not update that product', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('products').delete().eq('id', id);
    setDeleting(false);
    setDeleteTarget(null);
    if (!deleteError) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast(`${name} deleted`);
    } else {
      showToast('Could not delete that product', 'error');
    }
  }

  function startEdit(product: Product) {
    setError('');
    setEditingId(product.id);
    setEditDraft({
      name: product.name,
      description: product.description ?? '',
      price: product.price ? String(product.price) : '',
      stock_quantity: product.stock_quantity != null ? String(product.stock_quantity) : '',
    });
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    setError('');

    const { error: updateError } = await supabase
      .from('products')
      .update({
        name: editDraft.name,
        description: editDraft.description || null,
        price: editDraft.price ? Number(editDraft.price) : null,
        stock_quantity: editDraft.stock_quantity ? Number(editDraft.stock_quantity) : null,
      })
      .eq('id', id);

    setEditSaving(false);

    if (updateError) {
      setError(friendlyError(updateError));
      return;
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              name: editDraft.name,
              description: editDraft.description || null,
              price: editDraft.price ? Number(editDraft.price) : null,
              stock_quantity: editDraft.stock_quantity ? Number(editDraft.stock_quantity) : null,
            }
          : p
      )
    );
    setEditingId('');
  }

  // Same search-by-name filtering Services already had - Products was the
  // only one of the two near-identical entities with no way to find one
  // item in a long, entirely unpaginated list.
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }, [products, search]);

  // Live from this component's own state, not a static server-computed
  // prop - same reasoning as ServicesManager's activeCount/hiddenCount.
  const activeCount = useMemo(() => products.filter((p) => p.active).length, [products]);
  const hiddenCount = products.length - activeCount;

  return (
    <div>
      {/* Title and "Add product" now share one row instead of the button
          sitting on its own line below - same fix as ServicesManager's
          header, moved here from the page component for the same reason
          (the button's state already lives in this component). */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
            Manage · Products
          </div>
          <h1 className="font-display text-[26px] text-ink">Products</h1>
          {products.length > 0 && (
            <p className="font-mono text-[11px] text-ink-faint mt-1.5">
              {activeCount} active{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setError('');
            setShowAdd(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-body-sm font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add product
        </button>
      </div>

      {/* Overlay now, not an inline-expanding form pushing the whole list
          down the page - same fix as ServicesManager's AddServiceModal. */}
      {showAdd && (
        <ProductModal
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          price={price}
          setPrice={setPrice}
          stock={stock}
          setStock={setStock}
          saving={saving}
          error={error}
          onSubmit={handleAdd}
          onClose={() => setShowAdd(false)}
          title="Add product"
          submitLabel="Save product"
        />
      )}

      {/* Same modal, reused for editing - was the row itself expanding
          into a big inline form, pushing every row below it down the
          page. editDraft's field names (stock_quantity) don't match the
          modal's own prop name (stock) since that draft is one grouped
          object with a single setter - thin adapters over setEditDraft,
          not a second copy of the state. */}
      {editingId && (
        <ProductModal
          name={editDraft.name}
          setName={(v) => setEditDraft((d) => ({ ...d, name: v }))}
          description={editDraft.description}
          setDescription={(v) => setEditDraft((d) => ({ ...d, description: v }))}
          price={editDraft.price}
          setPrice={(v) => setEditDraft((d) => ({ ...d, price: v }))}
          stock={editDraft.stock_quantity}
          setStock={(v) => setEditDraft((d) => ({ ...d, stock_quantity: v }))}
          saving={editSaving}
          error={error}
          onSubmit={(e) => {
            e.preventDefault();
            saveEdit(editingId);
          }}
          onClose={() => setEditingId('')}
          title="Edit product"
          submitLabel="Save changes"
        />
      )}

      {products.length === 0 ? (
        <div className="border-2 border-dashed border-line-strong rounded-3xl p-10 text-center sm:p-14">
          <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path
                d="M20 7L12 3 4 7m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="font-display text-[20px]">No products yet</h2>
          <p className="text-ink-soft text-body-sm mt-1.5">Products are optional - they show on your page and let the assistant answer questions about what you sell. Use "Add product" above if you want them.</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-line overflow-hidden bg-surface">
          <div className="p-4 border-b border-line flex items-center justify-end">
            <div className="flex items-center gap-2 bg-paper rounded-full px-3.5 py-2 w-full sm:w-64 border border-transparent transition-colors focus-within:border-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint shrink-0">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="bg-transparent border-none outline-none focus:outline-none rounded-lg px-1 -mx-1 text-[13px] text-ink placeholder-ink-faint w-full"
              />
            </div>
          </div>
          <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_1fr_90px] gap-4 px-5 py-2.5 bg-paper border-b border-line font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-faint">
            <div>Product</div>
            <div>Price</div>
            <div>Stock</div>
            <div>Status</div>
            <div />
          </div>
          {filteredProducts.length === 0 && (
            <div className="px-5 py-8 text-center text-body-sm text-ink-faint">No products match &ldquo;{search}&rdquo;.</div>
          )}
          {filteredProducts.map((p, i) => (
              <div
                key={p.id}
                className={`flex flex-col gap-2.5 sm:grid sm:grid-cols-[1.6fr_1fr_1fr_1fr_90px] sm:gap-4 sm:items-center px-5 py-4 ${
                  i !== filteredProducts.length - 1 ? 'border-b border-line' : ''
                } ${!p.active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between sm:block">
                  <div>
                    <p className="font-semibold text-[14.5px]">{p.name}</p>
                    {p.description && (
                      <p className="hidden sm:block text-[12px] text-ink-faint mt-0.5 truncate max-w-[280px]">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`sm:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] ${
                      p.active ? 'bg-success-bg text-success' : 'bg-ink-wash text-ink-faint'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {p.active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="font-mono text-[13px] text-ink-soft">
                  {formatMoney(p.price)}
                </div>
                <div className="font-mono text-[13px] text-ink-soft">
                  {p.stock_quantity != null ? p.stock_quantity : '-'}
                </div>
                <div className="hidden sm:block">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] ${
                      p.active ? 'bg-success-bg text-success' : 'bg-ink-wash text-ink-faint'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {p.active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => startEdit(p)} aria-label="Edit" className={iconBtnClass}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button onClick={() => handleToggleActive(p)} aria-label={p.active ? 'Hide' : 'Show'} className={iconBtnClass}>
                    {p.active ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 5.1A9.9 9.9 0 0112 5c6.5 0 10 7 10 7a17.3 17.3 0 01-3.4 4.6M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 004.4-1" />
                        <path d="M9.9 9.9a3 3 0 004.2 4.2" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    aria-label="Delete"
                    className={`${iconBtnClass} hover:border-error hover:text-error`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete product?"
        message={`Delete ${deleteTarget?.name ?? 'this product'}? This can't be undone.`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
