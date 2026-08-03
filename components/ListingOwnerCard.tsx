"use client";

import * as React from "react";
import { Phone, MessageSquare, Lock, Handshake, CalendarClock } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { useRbac } from "@/components/RbacProvider";
import { listingAgent } from "@/lib/listings";
import { formatThaiDate } from "@/lib/format";

// Owner contact is PRIVATE. A sale sees the owner's name/phone only for listings they manage,
// or if they hold `contacts.view_all` (Listing Support / leadership — owners are contacts).
// Everyone else sees the managing agent's contact instead, so they can reach out to Co-Agent.
// Design-first: "manages this listing" uses the seeded managing agent (lib/listings); wire to
// the real creating-agent + real contacts RLS.
export function ListingOwnerCard({
  ownerName,
  ownerPhone,
  ownerLine,
  ownerTalkLastDate,
  activityComment,
  listingId,
}: {
  ownerName: string | null;
  ownerPhone: string | null;
  /** Owner's LINE — `owner_line`, auto-pulled in the source sheet (col W). */
  ownerLine?: string | null;
  /** `owner_talk_last_date` (col X) — last time anyone spoke to the owner. */
  ownerTalkLastDate?: string | null;
  /** `activity_comment` (col Y) — free-text note from that last owner conversation. */
  activityComment?: string | null;
  listingId: string;
}) {
  const { can, currentUser } = useRbac();
  const agent = listingAgent(listingId);
  const isManager = !!agent && currentUser.name === agent.nickname;
  const canSeeOwner = can("contacts.view_all") || isManager;

  if (canSeeOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>เจ้าของทรัพย์</CardTitle>
        </CardHeader>
        {ownerName ? (
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={ownerName} tone="crimson" className="h-10 w-10" />
              <div className="min-w-0">
                <div className="text-body font-medium truncate">{ownerName}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {ownerPhone && (
                    <a
                      href={`tel:${ownerPhone}`}
                      className="num text-small text-text-muted hover:text-accent inline-flex items-center gap-1 transition-colors"
                    >
                      <Phone size={12} strokeWidth={1.75} />
                      {ownerPhone}
                    </a>
                  )}
                  {ownerLine && (
                    <span className="text-small text-text-muted inline-flex items-center gap-1">
                      <MessageSquare size={12} strokeWidth={1.75} />
                      <span className="num">{ownerLine}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Last owner contact — the follow-up signal. The source sheet flags stale owner
                talk with conditional formatting; surfacing the date is the first step. */}
            {(ownerTalkLastDate || activityComment) && (
              <div className="border-t border-border pt-2.5 flex flex-col gap-1">
                {ownerTalkLastDate && (
                  <div className="flex items-center justify-between gap-2 text-small">
                    <span className="text-text-subtle inline-flex items-center gap-1">
                      <CalendarClock size={12} strokeWidth={1.75} /> คุยกับเจ้าของล่าสุด
                    </span>
                    <span className="num text-text-muted">{formatThaiDate(ownerTalkLastDate)}</span>
                  </div>
                )}
                {activityComment && (
                  <p className="text-small text-text-muted whitespace-pre-line">{activityComment}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-small text-text-subtle">ไม่ระบุเจ้าของ</div>
        )}
      </Card>
    );
  }

  // Co-agent view — owner hidden, managing agent's contact shown instead.
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Handshake size={16} strokeWidth={1.75} className="text-accent" />
          ผู้ดูแลทรัพย์
        </CardTitle>
        <Pill tone="neutral">Co-Agent</Pill>
      </CardHeader>
      {agent ? (
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={agent.nickname} src={agent.avatarUrl} tone="crimson" className="h-10 w-10" />
            <div className="min-w-0">
              <div className="text-body font-medium truncate num">{agent.nickname}</div>
              <div className="text-label text-text-subtle">{agent.position}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {agent.phone ? (
              <a href={`tel:${agent.phone}`} className="num text-small text-text-muted hover:text-accent inline-flex items-center gap-1 transition-colors">
                <Phone size={12} strokeWidth={1.75} /> {agent.phone}
              </a>
            ) : (
              <span className="text-small text-text-subtle">ไม่มีเบอร์โทร</span>
            )}
            {agent.lineUserId && (
              <span className="text-small text-text-muted inline-flex items-center gap-1">
                <MessageSquare size={12} strokeWidth={1.75} /> <span className="num">{agent.lineUserId}</span>
              </span>
            )}
          </div>
          <p className="text-label text-text-subtle inline-flex items-center gap-1.5">
            <Lock size={11} strokeWidth={1.75} /> ข้อมูลเจ้าของเป็นความลับ — ติดต่อผู้ดูแลเพื่อ Co-Agent
          </p>
        </div>
      ) : (
        <div className="p-4 text-small text-text-subtle">ไม่ระบุผู้ดูแล</div>
      )}
    </Card>
  );
}
