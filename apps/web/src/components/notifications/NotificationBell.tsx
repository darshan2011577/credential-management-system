import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  INotification,
} from '@credential-manager/types';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notification.api.js';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  RotateCw,
} from 'lucide-react';

interface NotificationBellProps {
  onNavigateTab?: (tab: 'vault' | 'health' | 'shared' | 'notifications') => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await fetchUnreadNotificationCount();
      setUnreadCount(res.unreadCount || 0);
    } catch {}
  }, []);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchNotifications(1, 15);
      setNotifications(res.items || []);
      const unread = (res.items || []).filter((n: INotification) => !n.isRead).length;
      setUnreadCount(unread);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkRead = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleNotificationClick = (notification: INotification) => {
    if (!notification.isRead) {
      markNotificationRead(notification.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    if (notification.type.startsWith('SHARE_') || notification.relatedEntityType === 'CredentialShare') {
      if (onNavigateTab) onNavigateTab('shared');
    }
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        className="btn btn-secondary btn-sm"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View notifications"
        style={{
          position: 'relative',
          padding: '0.35rem 0.6rem',
        }}
      >
        <Bell size={14} color={unreadCount > 0 ? 'var(--info)' : 'var(--text-secondary)'} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: 'var(--danger)',
              color: '#ffffff',
              fontSize: '0.62rem',
              fontWeight: 700,
              minWidth: '16px',
              height: '16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              border: '1.5px solid var(--bg-surface)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="modal-card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '360px',
            maxWidth: '90vw',
            maxHeight: '480px',
            padding: 0,
            zIndex: 9999,
          }}
        >
          {/* Header */}
          <div className="modal-header" style={{ padding: '0.65rem 0.95rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Bell size={14} color="var(--info)" />
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
              >
                <CheckCheck size={12} color="var(--success)" />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div
            style={{
              overflowY: 'auto',
              maxHeight: '380px',
              padding: '0.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            {isLoading && notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RotateCw size={18} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                <span style={{ fontSize: '0.78rem' }}>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Sparkles size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                  All Caught Up
                </div>
                <p style={{ fontSize: '0.76rem', margin: 0 }}>No unread notifications.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    background: item.isRead ? 'var(--bg-surface)' : 'var(--primary-subtle)',
                    border: `1px solid ${item.isRead ? 'var(--border-subtle)' : 'var(--primary-border)'}`,
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.15rem' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: item.isRead ? 500 : 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </span>
                      {!item.isRead && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--info)', flexShrink: 0 }} />
                      )}
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.3rem 0', lineHeight: 1.35 }}>
                      {item.message}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Clock size={10} />
                        {formatTimeAgo(item.createdAt)}
                      </span>

                      {!item.isRead && (
                        <button
                          onClick={(e) => handleMarkRead(e, item.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '1px 4px', fontSize: '0.68rem' }}
                        >
                          <Check size={11} /> Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
