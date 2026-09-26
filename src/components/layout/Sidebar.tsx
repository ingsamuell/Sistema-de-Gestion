import React from 'react';
import Image from 'next/image';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { UserProfileButton } from '@/components/layout/UserProfileButton';

interface SidebarProps {
  initialUser?: User | null;
}

export async function Sidebar({ initialUser }: SidebarProps) {
  let user = initialUser;

  if (user === undefined) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }
  }

  return (
    <aside
      id="tour-sidebar"
      className="hidden md:flex w-64 flex-col border-r border-outline-variant/30 bg-surface h-screen sticky top-0 left-0"
    >
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-1 rounded-lg text-primary flex items-center justify-center w-10 h-10 relative">
            <Image
              src="/images/mascot/chigui-focus.png"
              alt="Logo"
              fill
              sizes="40px"
              className="object-contain p-0.5"
            />
          </div>
          <div>
            <h2 className="font-bold text-primary tracking-tight leading-tight">Komorebi</h2>
            <p className="text-[10px] uppercase font-semibold text-accent-amber tracking-wider">
              Study Studio
            </p>
          </div>
        </div>
      </div>

      <SidebarNav />

      <div className="p-4 mt-auto border-t border-outline-variant/30">
        <UserProfileButton initialUser={user} />
      </div>
    </aside>
  );
}
