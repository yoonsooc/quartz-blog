import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import style from "../styles/listPage.scss"
import { PageList, SortFn, byDateAndAlphabetical } from "../PageList"
import { QuartzPluginData } from "../../plugins/vfile"
import { getDate } from "../Date"
import { concatenateResources } from "../../util/resources"

interface DateArchiveContentOptions {
  sort?: SortFn
}

export default ((opts?: Partial<DateArchiveContentOptions>) => {
  const DateArchiveContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { allFiles, cfg } = props
    const sorter = opts?.sort ?? byDateAndAlphabetical(cfg)

    // Group files by year-month
    const filesByYearMonth = new Map<string, Map<string, QuartzPluginData[]>>()
    for (const file of allFiles) {
      const date = getDate(cfg, file)
      if (!date) continue

      const year = date.getFullYear().toString()
      const month = (date.getMonth() + 1).toString().padStart(2, "0")

      if (!filesByYearMonth.has(year)) {
        filesByYearMonth.set(year, new Map())
      }
      const yearMap = filesByYearMonth.get(year)!
      if (!yearMap.has(month)) {
        yearMap.set(month, [])
      }
      yearMap.get(month)!.push(file)
    }

    const sortedYears = [...filesByYearMonth.keys()].sort((a, b) => b.localeCompare(a))

    const monthNames: Record<string, string> = {
      "01": "JAN",
      "02": "FEB",
      "03": "MAR",
      "04": "APR",
      "05": "MAY",
      "06": "JUN",
      "07": "JUL",
      "08": "AUG",
      "09": "SEP",
      "10": "OCT",
      "11": "NOV",
      "12": "DEC",
    }

    return (
      <div class="popover-hint">
        {sortedYears.map((year) => {
          const yearMap = filesByYearMonth.get(year)!
          const sortedMonths = [...yearMap.keys()].sort((a, b) => b.localeCompare(a))

          return (
            <div>
              <h2>{year}</h2>
              {sortedMonths.map((month) => {
                const pages = yearMap.get(month)!
                const listProps = { ...props, allFiles: pages }

                return (
                  <div>
                    <h3>{monthNames[month]}</h3>
                    <div class="page-listing">
                      <PageList {...listProps} sort={sorter} />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  DateArchiveContent.css = concatenateResources(style, PageList.css)
  return DateArchiveContent
}) satisfies QuartzComponentConstructor
