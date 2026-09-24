import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { EditorialReport, StyleAnalysis } from "@/lib/ai/editorial";
import { CharactersTab } from "./CharactersTab";
import { OverviewTab } from "./OverviewTab";
import { PacingTab } from "./PacingTab";
import { PlotTab } from "./PlotTab";
import { ProseTab } from "./ProseTab";
import { StyleTab } from "./StyleTab";

export function ReportTabs({
  report,
  style,
}: {
  report: EditorialReport;
  style: StyleAnalysis | null;
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList variant="line" className="print:hidden">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="pacing">Pacing</TabsTrigger>
        <TabsTrigger value="characters">Characters</TabsTrigger>
        <TabsTrigger value="plot">Plot</TabsTrigger>
        <TabsTrigger value="prose">Prose</TabsTrigger>
        {style && <TabsTrigger value="style">Style</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="print:!block">
        <OverviewTab report={report} />
      </TabsContent>
      <TabsContent value="pacing" className="print:!block">
        <PacingTab report={report} />
      </TabsContent>
      <TabsContent value="characters" className="print:!block">
        <CharactersTab report={report} />
      </TabsContent>
      <TabsContent value="plot" className="print:!block">
        <PlotTab report={report} />
      </TabsContent>
      <TabsContent value="prose" className="print:!block">
        <ProseTab report={report} />
      </TabsContent>
      {style && (
        <TabsContent value="style" className="print:!block">
          <StyleTab style={style} />
        </TabsContent>
      )}
    </Tabs>
  );
}
