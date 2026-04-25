import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { ProcessedContent, QuartzPluginData, defaultProcessedContent } from "../vfile"
import { FullPageLayout } from "../../cfg"
import { FullSlug, pathToRoot } from "../../util/path"
import { defaultListPageLayout, sharedPageComponents } from "../../../quartz.layout"
import DateArchiveContent from "../../components/pages/DateArchiveContent"
import { write } from "./helpers"
import { BuildCtx } from "../../util/ctx"

interface DateArchiveOptions extends FullPageLayout {
  sort?: (f1: QuartzPluginData, f2: QuartzPluginData) => number
}

export const DateArchive: QuartzEmitterPlugin<Partial<DateArchiveOptions>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: DateArchiveContent({ sort: userOpts?.sort }),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer, banner } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "DateArchive",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
        ...(banner ?? []),
      ]
    },
    async *emit(ctx, content, resources) {
      const allFiles = content.map((c) => c[1].data)
      const slug = "index" as FullSlug

      const [tree, file] = defaultProcessedContent({
        slug,
        frontmatter: { title: "", tags: [] },
      })

      const cfg = ctx.cfg.configuration
      const externalResources = pageResources(pathToRoot(slug), resources)
      const componentData: QuartzComponentProps = {
        ctx,
        fileData: file.data,
        externalResources,
        cfg,
        children: [],
        tree,
        allFiles,
      }

      const content_ = renderPage(cfg, slug, componentData, opts, externalResources)
      yield write({
        ctx,
        content: content_,
        slug: file.data.slug!,
        ext: ".html",
      })
    },
  }
}
