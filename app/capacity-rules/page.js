'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Modal from '@/components/common/Modal';
import Badge from '@/components/common/Badge';
import ConfirmModal from '@/components/common/ConfirmModal';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import {
  subscribeCapacityRules,
  updateCapacityRule,
  seedDefaultCapacityRules
} from '@/services/capacityService';
import {
  Sliders,
  RotateCcw,
  Edit2,
  Sparkles,
  CheckCircle2,
  Info
} from 'lucide-react';
import { ROLES, ROLE_LABELS } from '@/lib/constants';

export default function CapacityRulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);

  // Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    dailyLimits: { posts: 0, reels: 0, stories: 0 },
    weights: { posts: 1, reels: 1, stories: 1 },
  });
  const [isSaving, setIsSaving] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubscribe = subscribeCapacityRules((data) => {
      setRules(data || []);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name || '',
      dailyLimits: {
        posts: Number(rule.dailyLimits?.posts) || 0,
        reels: Number(rule.dailyLimits?.reels) || 0,
        stories: Number(rule.dailyLimits?.stories) || 0,
      },
      weights: {
        posts: Number(rule.weights?.posts) || 1,
        reels: Number(rule.weights?.reels) || 1,
        stories: Number(rule.weights?.stories) || 1,
      },
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateCapacityRule(editingRule.id, formData);
      success(`Updated capacity rule for ${ROLE_LABELS[editingRule.role] || editingRule.role}.`);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      error('Failed to update capacity rule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      await seedDefaultCapacityRules();
      success('Default capacity rules populated successfully.');
      setShowSeedModal(false);
    } catch (err) {
      console.error(err);
      error('Failed to seed rules.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <AppLayout
      title="Capacity & Productivity Rules"
      subtitle="Define daily output quotas, deliverable effort multipliers, and baseline capacities"
    >
      <div className="space-y-6 bg-white">
        {/* Info & Reset Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-600">
            <strong>Equivalency Formula:</strong> Total Daily Units = (Posts × Weight) + (Reels × Weight) + (Stories × Weight).
          </div>

          <Button
            variant="secondary"
            icon={RotateCcw}
            onClick={() => setShowSeedModal(true)}
            isLoading={isSeeding}
            className="flex-shrink-0"
          >
            Reset Default Agency Rules
          </Button>
        </div>

        {/* Rules Cards Grid */}
        {loading ? (
          <SkeletonTable rows={2} cols={4} />
        ) : rules.length === 0 ? (
          <EmptyState
            icon={Sliders}
            title="No Capacity Rules Found"
            description="Initialize default productivity rules to calculate staff workload capacities."
            actionLabel="Seed Default Rules"
            onAction={handleSeedDefaults}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rules.map((rule) => {
              const dailyPostUnits = (rule.dailyLimits?.posts || 0) * (rule.weights?.posts || 1);
              const dailyReelUnits = (rule.dailyLimits?.reels || 0) * (rule.weights?.reels || 1);
              const dailyStoryUnits = (rule.dailyLimits?.stories || 0) * (rule.weights?.stories || 1);
              const totalDailyUnits = dailyPostUnits + dailyReelUnits + dailyStoryUnits;

              return (
                <Card key={rule.id} className="space-y-4">
                  <CardHeader
                    title={ROLE_LABELS[rule.role] || rule.name}
                    subtitle={`Baseline: ${totalDailyUnits} Capacity Units per Working Day`}
                    action={
                      <div className="flex items-center gap-2">
                        <Badge role={rule.role} />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit2}
                          onClick={() => openEditModal(rule)}
                        >
                          Edit
                        </Button>
                      </div>
                    }
                  />

                  {/* Limits and Weights Matrix */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Posts</p>
                      <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                        {rule.dailyLimits?.posts || 0} / Day
                      </p>
                      <p className="text-[10px] text-indigo-700 font-bold mt-1">
                        Weight: {rule.weights?.posts || 1}x ({dailyPostUnits} Units)
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Reels</p>
                      <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                        {rule.dailyLimits?.reels || 0} / Day
                      </p>
                      <p className="text-[10px] text-indigo-700 font-bold mt-1">
                        Weight: {rule.weights?.reels || 1}x ({dailyReelUnits} Units)
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Stories</p>
                      <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                        {rule.dailyLimits?.stories || 0} / Day
                      </p>
                      <p className="text-[10px] text-indigo-700 font-bold mt-1">
                        Weight: {rule.weights?.stories || 1}x ({dailyStoryUnits} Units)
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">Weekly Baseline (5 Working Days):</span>
                    <span className="font-extrabold text-indigo-700">
                      {totalDailyUnits * 5} Total Units
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Rule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={`Edit Capacity Rule: ${ROLE_LABELS[editingRule?.role] || ''}`}
        subtitle="Adjust standard daily deliverable counts and workload weights"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Rule Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Daily Output Limits & Weights
            </h4>

            {/* Posts */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <Input
                label="Daily Posts"
                type="number"
                min="0"
                value={formData.dailyLimits.posts}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dailyLimits: { ...formData.dailyLimits, posts: Number(e.target.value) || 0 },
                  })
                }
              />
              <Input
                label="Post Weight Multiplier"
                type="number"
                min="1"
                step="0.5"
                value={formData.weights.posts}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weights: { ...formData.weights, posts: Number(e.target.value) || 1 },
                  })
                }
              />
            </div>

            {/* Reels */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <Input
                label="Daily Reels"
                type="number"
                min="0"
                value={formData.dailyLimits.reels}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dailyLimits: { ...formData.dailyLimits, reels: Number(e.target.value) || 0 },
                  })
                }
              />
              <Input
                label="Reel Weight Multiplier"
                type="number"
                min="1"
                step="0.5"
                value={formData.weights.reels}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weights: { ...formData.weights, reels: Number(e.target.value) || 1 },
                  })
                }
              />
            </div>

            {/* Stories */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <Input
                label="Daily Stories"
                type="number"
                min="0"
                value={formData.dailyLimits.stories}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dailyLimits: { ...formData.dailyLimits, stories: Number(e.target.value) || 0 },
                  })
                }
              />
              <Input
                label="Story Weight Multiplier"
                type="number"
                min="1"
                step="0.5"
                value={formData.weights.stories}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weights: { ...formData.weights, stories: Number(e.target.value) || 1 },
                  })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              Save Capacity Rule
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Confirmation */}
      <ConfirmModal
        isOpen={showSeedModal}
        onClose={() => !isSeeding && setShowSeedModal(false)}
        onConfirm={handleSeedDefaults}
        title="Reset Default Capacity Rules"
        message="This will overwrite current capacity limits with the recommended agency baseline (Graphic Designer: 7 units/day, Video Editor: 4 units/day). Do you want to continue?"
        confirmText="Reset Defaults"
        variant="brand"
        isLoading={isSeeding}
      />
    </AppLayout>
  );
}
