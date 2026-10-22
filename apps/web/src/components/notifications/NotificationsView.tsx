import React, { useState, useEffect, useCallback } from 'react';
import {
  INotification,
} from '@credential-manager/types';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notification.api.js';
import { NavigationTab } from '../layout/AppShell.js';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Inbox,
  RefreshCw,
  Share2,
  Shield,
} from 'lucide-react';

interface NotificationsViewProps {
  onNavigateTab: (tab: NavigationTab) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigateTab }) => {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'SECURITY' | 'SHARING'>('ALL');
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNotifications(1, 50);
      setNotifications(res.items || []);
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const formatTimeAgo = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
    } catch {}
    finally {
      setIsMarkingAll(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'SECURITY') return n.type.includes('SECURITY') || n.type.includes('ALERT');
    if (filter === 'SHARING') return n.type.includes('SHARE');
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1000px' }}>
      {/* Header & Filter Controls */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
          padding: '1.15rem 1.35rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--info-bg)',
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--info-border)',
            }}
          >
            <Bell size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Stay updated on credential sharing requests and account activity.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {unreadCount > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleMarkAllRead}
              disabled={isMarkingAll}
            >
              <CheckCheck size={13} color="var(--success)" />
              Mark All Read
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadNotifications}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        <button
          className={`btn btn-sm ${filter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('ALL')}
        >
          All ({notifications.length})
        </button>
        <button
          className={`btn btn-sm ${filter === 'UNREAD' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('UNREAD')}
        >
          Unread ({unreadCount})
        </button>
        <button
          className={`btn btn-sm ${filter === 'SHARING' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('SHARING')}
        >
          <Share2 size={12} />
          Sharing ({notifications.filter((n) => n.type.includes('SHARE')).length})
        </button>
        <button
          className={`btn btn-sm ${filter === 'SECURITY' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('SECURITY')}
        >
          <Shield size={12} />
          Security ({notifications.filter((n) => n.type.includes('SECURITY') || n.type.includes('ALERT')).length})
        </button>
      </div>

      {/* Notifications List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem' }} />
            <div>Loading notification feed...</div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Inbox size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              No Notifications in this View
            </div>
            <p style={{ fontSize: '0.8rem' }}>You're all caught up with your security alerts.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  padding: '0.85rem 1.15rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: item.isRead ? 'transparent' : 'var(--primary-subtle)',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-xs)',
                      background: item.type.includes('SHARE') ? 'var(--purple-bg)' : 'var(--info-bg)',
                      color: item.type.includes('SHARE') ? 'var(--purple)' : 'var(--info)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.type.includes('SHARE') ? <Share2 size={15} /> : <Bell size={15} />}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontWeight: item.isRead ? 600 : 700, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                        {item.title}
                      </span>
                      {!item.isRead && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--info)' }} />
                      )}
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                      {item.message}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={11} />
                        {formatTimeAgo(item.createdAt)}
                      </span>

                      {item.type.includes('SHARE') && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => onNavigateTab('shared')}
                          style={{ padding: '0 0.35rem', fontSize: '0.72rem', color: 'var(--purple)' }}
                        >
                          View in Sharing &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {!item.isRead && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleMarkRead(item.id)}
                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                  >
                    <Check size={12} />
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
