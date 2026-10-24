import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  PauseIcon,
  PlayIcon,
  StarFilledIcon,
  StarIcon,
  VideoIcon,
} from "@radix-ui/react-icons";
import { Carousel } from "../mobile";
import type { Material, Task } from "../api";
import "./story-discovery.css";
export default function StoryDiscovery({
  tasks,
  onDetail,
  onBookmark,
  onVideo,
  busy,
  initialTaskId,
  onSelect,
}: {
  tasks: Task[];
  onDetail: (task: Task) => void;
  onBookmark: (task: Task) => void;
  onVideo: (video: Material) => void;
  busy: boolean;
  initialTaskId?: string;
  onSelect?: (id: string) => void;
}) {
  const [genre, setGenre] = useState("全部"),
    [selectedId, setSelectedId] = useState(initialTaskId || tasks[0]?.id || ""),
    [tour, setTour] = useState(false);
  const visible = tasks.filter((t) => genre === "全部" || t.genre === genre),
    selected = visible.find((t) => t.id === selectedId) || visible[0];
  const visibleKey = visible.map((t) => t.id).join("|");
  useEffect(() => {
    if (selected) onSelect?.(selected.id);
  }, [selected?.id, onSelect]);
  useEffect(() => {
    if (!tour || visible.length < 2) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        setSelectedId((previous) => {
          const index = visible.findIndex((t) => t.id === previous);
          return visible[(index + 1) % visible.length].id;
        });
    }, 8000);
    return () => clearInterval(timer);
  }, [tour, visibleKey]);
  function select(id: string) {
    setTour(false);
    setSelectedId(id);
  }
  function step(direction: number) {
    if (!selected) return;
    const index = visible.findIndex((t) => t.id === selected.id);
    select(visible[(index + direction + visible.length) % visible.length].id);
  }
  if (!selected)
    return (
      <div className="d-empty">
        <ImageIcon />
        <h2>这里还在等待新的故事</h2>
        <p>上架剧集后，会在这里呈现海报与实际素材。</p>
        {genre !== "全部" && (
          <button onClick={() => setGenre("全部")}>返回全部题材</button>
        )}
      </div>
    );
  const index = visible.findIndex((t) => t.id === selected.id),
    video = (selected.materials || []).find((m) => m.kind === "video");
  return (
    <div className="d-discovery">
      <div className="d-heading">
        <div>
          <span>THE STORY THEATER</span>
          <h2>把目光，交给好故事</h2>
          <p>海报与实际素材，慢慢发现。</p>
        </div>
        <button
          aria-label={tour ? "暂停海报巡游" : "开启海报巡游"}
          aria-pressed={tour}
          disabled={visible.length < 2}
          onClick={() => setTour((v) => !v)}
        >
          {tour ? <PauseIcon /> : <PlayIcon />}
          {tour ? "巡游中" : "自动巡游"}
        </button>
      </div>
      <Carousel ariaLabel="剧场题材" contentClassName="d-genre-track">
        {["全部", ...new Set(tasks.map((t) => t.genre))].map((g) => (
          <button
            key={g}
            aria-pressed={genre === g}
            onClick={() => {
              setGenre(g);
              setTour(false);
            }}
          >
            {g}
          </button>
        ))}
      </Carousel>
      <section className="d-stage" aria-label="当前海报">
        <img className="d-ambient" src={selected.cover} alt="" />
        <div className="d-poster-frame" key={selected.id}>
          <img src={selected.cover} alt={selected.title + "海报"} />
          <span className="d-poster-format">
            <ImageIcon />
            海报预览
          </span>
          <div className="d-poster-gradient" />
          <div
            className="d-poster-copy"
            aria-live={tour ? "off" : "polite"}
            aria-atomic="true"
          >
            <span>{selected.genre}</span>
            <h2>{selected.title}</h2>
            <p>
              {selected.platform} · {selected.episodes} 集 · {selected.language}
            </p>
          </div>
        </div>
        <div className="d-navigation">
          <button
            aria-label="上一部剧集"
            disabled={visible.length < 2}
            onClick={() => step(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <span>
            <b>{String(index + 1).padStart(2, "0")}</b> /{" "}
            {String(visible.length).padStart(2, "0")}
          </span>
          <button
            aria-label="下一部剧集"
            disabled={visible.length < 2}
            onClick={() => step(1)}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </section>
      <section className="d-story-info">
        <div>
          <span>STORY NOTES</span>
          <button
            disabled={busy}
            aria-label={
              (selected.bookmarked ? "取消收藏" : "收藏") + selected.title
            }
            aria-pressed={selected.bookmarked}
            onClick={() => onBookmark(selected)}
          >
            {selected.bookmarked ? <StarFilledIcon /> : <StarIcon />}
            {selected.bookmarked ? "已收藏" : "收藏故事"}
          </button>
        </div>
        <p>{selected.description}</p>
        <div className="d-story-tags">
          {selected.tags?.slice(0, 4).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
        <button className="d-detail" onClick={() => onDetail(selected)}>
          查看剧集与素材 <ArrowRightIcon />
        </button>
        {video ? (
          <button
            className="d-video-link"
            onClick={() => {
              setTour(false);
              onVideo(video);
            }}
          >
            <VideoIcon />
            预览已上传的视频素材 <ChevronRightIcon />
          </button>
        ) : (
          <small className="d-material-note">
            当前未上传视频素材；这里展示静态海报。
          </small>
        )}
      </section>
      <div className="d-library-title">
        <h3>还有这些故事</h3>
        <span>左右滑动 · 点击切换</span>
      </div>
      <Carousel ariaLabel="剧场海报选择" contentClassName="d-filmstrip">
        {visible.map((t) => (
          <button
            key={t.id}
            aria-label={"切换到" + t.title}
            aria-pressed={selected.id === t.id}
            onClick={() => select(t.id)}
          >
            <span>
              <img loading="lazy" src={t.cover} alt="" />
              {selected.id === t.id && <i />}
            </span>
            <b>{t.title}</b>
            <small>{t.genre}</small>
          </button>
        ))}
      </Carousel>
      <p className="d-footer">巡游仅切换海报，不会自动播放视频或办理任务。</p>
    </div>
  );
}
