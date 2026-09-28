'use client';

import React, { useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { deleteUserAccountAction } from '@/features/profile/actions/deleteUserAccountAction';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  warningText: string;
  cancelText: string;
  confirmText: string;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  title,
  warningText,
  cancelText,
  confirmText,
}: DeleteAccountModalProps) {
  const router = useRouter();
  const [isDeleting, startDeleting] = useTransition();

  async function handleDelete() {
    startDeleting(async () => {
      const res = await deleteUserAccountAction();
      
      if (!res.success) {
        // You could use a toast here if there's a toast system
        alert(res.error || 'Ocurrió un error al eliminar la cuenta');
        return;
      }

      // Cerrar sesión en el cliente
      const supabase = createClient();
      await supabase.auth.signOut();
      
      // Redirigir a inicio/login
      router.push('/');
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isDeleting ? onClose : undefined}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="relative overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-2xl">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="absolute right-4 top-4 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low focus:outline-none disabled:opacity-50"
              >
                <X className="size-5" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-status-error/10 text-status-error">
                  <AlertTriangle className="size-6" />
                </div>
                <h2 className="text-xl font-bold text-on-surface">{title}</h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {warningText}
                </p>

                <div className="mt-6 flex justify-end gap-3 w-full">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    disabled={isDeleting}
                  >
                    {cancelText}
                  </Button>
                  <button
                    type="button"
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isDeleting ? 'Eliminando...' : confirmText}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
