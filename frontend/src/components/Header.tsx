"use client";

import Image from "next/image";
import toast from "react-hot-toast";
import { User } from "@/types";
import { api, slackConnectUrl } from "@/lib/api";
import { Button } from "./Button";
import { Logo } from "./Logo";

interface HeaderProps {
  user: User;
  onLoggedOut: () => void;
}

export function Header({ user, onLoggedOut }: HeaderProps) {
  const handleLogout = async () => {
    try {
      await api.logout();
      onLoggedOut();
    } catch {
      toast.error("Failed to log out");
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-y-2 border-b border-slate-200 bg-white/80 px-6 py-3.5 backdrop-blur supports-[backdrop-filter]:sticky supports-[backdrop-filter]:top-0 supports-[backdrop-filter]:z-10">
      <div className="flex shrink-0 items-center gap-2">
        <Logo />
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-4">
        {user.slackConnected ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Slack connected
          </span>
        ) : (
          <a href={slackConnectUrl()} className="shrink-0">
            <Button variant="secondary" type="button">
              Connect Slack
            </Button>
          </a>
        )}

        <div className="hidden h-6 w-px shrink-0 bg-slate-200 sm:block" />

        <div className="flex min-w-0 items-center gap-2">
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={user.name}
              width={32}
              height={32}
              className="shrink-0 rounded-full ring-2 ring-white"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-medium text-white">
              {user.name.charAt(0)}
            </div>
          )}
          <div className="hidden min-w-0 text-sm leading-tight sm:block">
            <div className="truncate font-medium text-slate-900">{user.name}</div>
            <div className="truncate text-slate-500">{user.email}</div>
          </div>
        </div>

        <Button variant="ghost" className="shrink-0" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
