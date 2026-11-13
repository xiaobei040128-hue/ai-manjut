import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import { Component, type ReactNode } from "react";
import { ReloadIcon } from "@radix-ui/react-icons";
export default class DesignBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section
          className={
            "u-preview-error" +
            (import.meta.env.PROD || new URLSearchParams(location.search).get("view") === "app" ||
            window.innerWidth <= 600
              ? " native-mode"
              : "")
          }
          role="alert"
        >
          <ReloadIcon />
          <h2>{tx("这个页面暂时没有加载完整")}</h2>
          <p>{tx("重新载入后再试。已经保存的账户记录不会被清空。")}</p>
          <button onClick={() => location.reload()}>{tx("重新载入页面")}</button>
          <a href="/?view=app">{tx("返回应用首页")}</a>
        </section>
      );
    return this.props.children;
  }
}
