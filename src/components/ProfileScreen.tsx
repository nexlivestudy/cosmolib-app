import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Pencil, Trash2, X } from 'lucide-react';
import { supabase, NEXLIVE_STORAGE_BUCKET } from '../lib/supabase';
import type { UserProfile } from '../types';
import {
  getFollowCounts,
  getPublicProfile,
  listPosts,
  createPost,
  deletePost,
  updateMyProfile,
  type ProfilePost,
  type PublicProfile,
} from '../lib/social';
import { FollowButton } from './GroupMembers';
import { sanitizeUserText } from '../utils/security';

interface Props {
  me: UserProfile;
  userId: string;
  userName: string;
  onlineIds: string[];
  onOpenChat: (peerId: string, peerName: string) => void;
  canMessageWith: (peerId: string) => boolean;
  onClose: () => void;
  onProfileChanged?: () => void;
  /** Render as a full tab page instead of a floating modal (used by the Profile nav tab). */
  asPage?: boolean;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return 'CS';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase();
}

export const ProfileScreen: React.FC<Props> = ({
  me,
  userId,
  userName,
  onlineIds,
  onOpenChat,
  canMessageWith,
  onClose,
  onProfileChanged,
}) => {
  const isMine = userId === me.id;
  const [pub, setPub] = useState<PublicProfile | null>(null);
  const [counts, setCounts] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingDp, setUploadingDp] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, c, ps] = await Promise.all([
        getPublicProfile(userId, onlineIds),
        getFollowCounts(userId),
        listPosts(userId, 24),
      ]);
      setPub(p);
      setCounts(c);
      setPosts(ps);
      if (p) {
        setEditName(p.name);
        setEditBio(p.bio);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    if (!supabase) return null;
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'photo.jpg';
    const path = `${me.id}/${folder}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(NEXLIVE_STORAGE_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(NEXLIVE_STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  };

  const handleDpPick = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setSaveError('Pick an image file for your display picture.');
      return;
    }
    setUploadingDp(true);
    setSaveError(null);
    try {
      const url = await uploadImage(file, 'dp');
      if (!url) throw new Error('Upload failed.');
      const res = await updateMyProfile(me.id, { avatar_url: url });
      if (!res.ok) throw new Error(res.error || 'Save failed.');
      await refresh();
      onProfileChanged?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'DP upload failed.');
    } finally {
      setUploadingDp(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await updateMyProfile(me.id, {
        display_name: sanitizeUserText(editName, 60),
        bio: sanitizeUserText(editBio, 160),
      });
      if (!res.ok) throw new Error(res.error || 'Save failed.');
      setEditing(false);
      await refresh();
      onProfileChanged?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoPick = (file: File | undefined) => {
    setPhotoFile(file || null);
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoPreview(null);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setPostError(null);
    try {
      let url: string | null = null;
      if (photoFile) {
        if (!photoFile.type.startsWith('image/')) throw new Error('Post photo must be an image.');
        url = await uploadImage(photoFile, 'posts');
      }
      const res = await createPost(me.id, caption, url);
      if (!res.ok) throw new Error(res.error || 'Post failed.');
      setCaption('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setComposerOpen(false);
      await refresh();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Post failed.');
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Delete this post?')) return;
    const ok = await deletePost(me.id, id);
    if (ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  if (asPage) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ProfileBody />
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-[#111827] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {isMine ? 'Your profile' : 'Profile'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close profile" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && <p className="p-6 text-center text-xs text-slate-500">Loading profile...</p>}
          {loading && pub && (
            <>
              <div className="flex items-start gap-4 p-5">
                <div className="relative shrink-0">
                  {pub.avatarUrl ? (
                    <img src={pub.avatarUrl} alt={`${pub.name} display picture`} className="h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-2xl font-bold text-white">
                      {initials(pub.name)}
                    </span>
                  )}
                  {pub.online && (
                    <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 dark:border-[#111827]" />
                  )}
                  {isMine && (
                    <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-indigo-600 p-1.5 text-white shadow hover:bg-indigo-500" title="Change display picture">
                      <Camera className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void handleDpPick(f);
                        }}
                      />
                    </label>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-xl font-bold text-slate-900 dark:text-white">{pub.name}</h3>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {[pub.branch, pub.institution].filter(Boolean).join(' - ') || 'Cosmo Scholar'}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span><strong className="text-slate-900 dark:text-white">{counts.followers}</strong> followers</span>
                    <span><strong className="text-slate-900 dark:text-white">{counts.following}</strong> following</span>
                    <span><strong className="text-amber-600">{pub.streakDays}d</strong> streak</span>
                  </div>
                </div>
              </div>
              {uploadingDp && <p className="px-5 text-xs text-slate-500">Uploading display picture...</p>}
              {pub.bio ? (
                <p className="px-5 pb-1 text-sm text-slate-700 dark:text-slate-300">{pub.bio}</p>
              ) : (
                isMine && <p className="px-5 pb-1 text-xs italic text-slate-400">Add a bio so study partners know your goals.</p>
              )}
              {saveError && <p role="alert" className="px-5 pt-1 text-xs font-medium text-red-600 dark:text-red-400">{saveError}</p>}
              <div className="flex items-center gap-2 px-5 py-3">
                {isMine ? (
                  <button
                    type="button"
                    onClick={() => setEditing((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5" /> {editing ? 'Cancel editing' : 'Edit profile'}
                  </button>
                ) : (
                  <>
                    <FollowButton myId={me.id} myName={userName} peerId={pub.id} peerName={pub.name} />
                    <button
                      type="button"
                      disabled={!canMessageWith(pub.id)}
                      title={canMessageWith(pub.id) ? 'Open chat' : 'Follow and get accepted to chat'}
                      onClick={() => canMessageWith(pub.id) && onOpenChat(pub.id, pub.name)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Message
                    </button>
                  </>
                )}
              </div>

              {isMine && editing && (
                <form onSubmit={handleSaveProfile} className="space-y-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                  <div>
                    <label htmlFor="profile-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Display name</label>
                    <input
                      id="profile-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your study handle"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-bio" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Bio (max 160)</label>
                    <textarea
                      id="profile-bio"
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value.slice(0, 160))}
                      placeholder="e.g. GATE CS 2027 aspirant - OS + DBMS daily - open to late-night rooms"
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                    />
                    <p className="mt-0.5 text-right text-[11px] text-slate-400 tabular-nums">{editBio.length}/160</p>
                  </div>
                  <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save profile'}
                  </button>
                </form>
              )}

              <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Posts ({posts.length})</h4>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => setComposerOpen((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                    >
                      <ImagePlus className="h-3.5 w-3.5" /> New post
                    </button>
                  )}
                </div>
                {isMine && composerOpen && (
                  <form onSubmit={handlePost} className="mt-3 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                      placeholder="Share a win, formula sheet, or study setup..."
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                    />
                    {photoPreview && <img src={photoPreview} alt="Post preview" className="max-h-48 w-full rounded-lg object-cover" />}
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                        <ImagePlus className="h-3.5 w-3.5" /> {photoFile ? 'Change photo' : 'Add photo'}
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            handlePhotoPick(f);
                          }}
                        />
                      </label>
                      <button type="submit" disabled={posting} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                        {posting ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                    {postError && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{postError}</p>}
                  </form>
                )}
                {posts.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    {isMine ? 'No posts yet - share your first study win above.' : 'No posts yet.'}
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {posts.map((p) => (
                      <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.caption.slice(0, 60) || 'Study post'} title={p.caption} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                            {p.caption.slice(0, 120)}
                          </div>
                        )}
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => void handleDeletePost(p.id)}
                            aria-label="Delete post"
                            className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {!loading && !pub && (
            <p className="p-6 text-center text-xs text-slate-500">Could not load this profile.</p>
          )}
        </div>
      </div>
    </div>
  );
};
