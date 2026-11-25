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

// __PART2__
