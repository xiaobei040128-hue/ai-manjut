import EnrollmentCard from "./EnrollmentCard";
import { useAccountJourney } from "./AccountJourney";
import { useState } from "react";
import {
  ArrowRightIcon,
  LockClosedIcon,
  ReaderIcon,
} from "@radix-ui/react-icons";
import { validateSimulation } from "./stageSimulation";
import "./stage-hub.css";

export default function StageHub({ compact = false }: { compact?: boolean }) {
  const { newcomer: first, advanced: next } = useAccountJourney();
  const firstComplete = first.stage === 6;
  const journey = {
    firstComplete,
    completed: firstComplete
      ? (next.community?.completed ?? 0)
      : first.stage <= 4
        ? first.stage
        : 4,
    total: firstComplete ? 5 : 6,
    advancedComplete: firstComplete && next.community?.completed === 5,
  };
  const advanced = journey.firstComplete;
  return (
    <section
      className={"s-stage-hub" + (compact ? " is-compact" : "") + (journey.advancedComplete ? " is-complete" : "")}
      aria-label="阶段任务中心"
    >
      <div className="s-stage-hub-art">
        <img src="/art/task-invitation-v1.png" alt="未拆封的任务邀请函" />
        <span>CREATOR JOURNEY · 成长计划</span>
        <h2>
          {journey.advancedComplete
            ? "这一章，已经完成"
            : "你的下一份任务，等待揭晓"}
        </h2>
        <p>系统派发 · 逐步解锁</p>
      </div>
      <div className="s-stage-hub-current">
        <div className="s-stage-hub-label">
          <ReaderIcon />
          当前阶段 <b>{advanced ? "02" : "01"}</b>
        </div>
        <h3>{advanced ? "AI 漫剧探索计划" : "新手创作旅程"}</h3>
        <div className="s-stage-hub-progress">
          <span>
            {journey.advancedComplete ? "本阶段已完成" : "已完成进度"}
          </span>
          <b>{Math.round((journey.completed / journey.total) * 100)}%</b>
        </div>
        <progress
          aria-label="当前阶段完成进度"
          value={Math.round((journey.completed / journey.total) * 100)}
          max={100}
        />
        <p>{journey.advancedComplete ? "第二阶段已完成，报名状态见下方。" : "完成当前任务，解锁下一次揭晓。"}</p>
        <a
          className="s-stage-hub-continue"
          href={"/?view=app&design=" + (advanced ? "advanced" : "newcomer")}
        >
          {journey.advancedComplete ? "查看阶段回顾" : "继续当前阶段"}
          <ArrowRightIcon />
        </a>
      </div>
      {journey.advancedComplete && <EnrollmentCard/>}
      {!compact && !journey.advancedComplete && (
        <>
          <div className="s-stage-hub-locked">
            <LockClosedIcon />
            <div>
              <b>后续篇章 · 尚未揭晓</b>
              <p>
                {journey.advancedComplete
                  ? "后续篇章准备中，敬请期待。"
                  : "完成当前阶段后，再开启下一段旅程。"}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
