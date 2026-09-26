'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Clock } from 'lucide-react';
import { STUDY_TECHNIQUES } from '@/features/study-methods/data/techniques';
import { useFocusSession } from '@/contexts/FocusSessionContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface TechniqueSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string;
  taskTitle?: string;
}

export function TechniqueSelectionModal({
  isOpen,
  onClose,
  taskId,
  taskTitle,
}: TechniqueSelectionModalProps) {
  const { startSession } = useFocusSession();

  const handleStart = (techniqueId: string) => {
    startSession(techniqueId, taskId, taskTitle);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-6 border-b border-surface-container-high">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Elige tu técnica de estudio</h2>
              {taskTitle && (
                <p className="text-sm text-on-surface-variant mt-1">
                  Para la tarea: <span className="font-semibold text-primary">{taskTitle}</span>
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {STUDY_TECHNIQUES.map((technique) => (
                <Card
                  key={technique.id}
                  className="p-5 hover:shadow-md transition-shadow flex flex-col h-full border border-surface-container-highest cursor-pointer hover:border-primary/50 group"
                  onClick={() => handleStart(technique.id)}
                >
                  <div
                    className="h-2 w-16 rounded-full mb-4 opacity-70 group-hover:opacity-100 transition-opacity"
                    style={{ background: technique.gradient }}
                  />

                  <h3 className="text-lg font-bold text-on-surface mb-1">{technique.name}</h3>

                  <div className="flex items-center text-sm font-medium text-primary mb-3">
                    <Clock className="size-4 mr-1.5" />
                    {technique.shortDescription}
                  </div>

                  <p className="text-sm text-on-surface-variant mb-4 flex-grow">
                    {technique.description}
                  </p>

                  <Button className="w-full gap-2 mt-auto" variant="secondary">
                    <Play className="size-4" /> Iniciar Sesión
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
