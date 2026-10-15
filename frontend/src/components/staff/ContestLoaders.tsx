"use client";

import { getContest, getResults } from "@/lib/api/contests";
import { canScore } from "@/lib/contestScoring";
import { ContestScreen } from "./ContestScreen";
import { JuryScreen } from "./JuryScreen";
import { NoAccess } from "./NoAccess";
import { ResourceView, useResource } from "./Resource";
import { ResultsNotReady } from "./ResultsNotReady";
import { ResultsScreen } from "./ResultsScreen";
import { useCurrentUser } from "./SessionProvider";

/** /contests/<id>: the contest page. */
export function ContestLoader({ id }: { id: string }) {
  const resource = useResource(() => getContest(id));
  return <ResourceView resource={resource}>{(contest) => <ContestScreen contest={contest} />}</ResourceView>;
}

/** /contests/<id>/score: only a jury member of an open contest may score. */
export function ScoreLoader({ id }: { id: string }) {
  const user = useCurrentUser();
  const resource = useResource(() => getContest(id));
  return (
    <ResourceView resource={resource}>
      {(contest) => (canScore(contest, user.id) ? <JuryScreen contest={contest} /> : <NoAccess contestId={contest.id} />)}
    </ResourceView>
  );
}

/** /contests/<id>/results: the ranking exists once the contest is closed. */
export function ResultsLoader({ id }: { id: string }) {
  const resource = useResource(async () => {
    const contest = await getContest(id);
    return { contest, results: contest.status === "closed" ? await getResults(id) : null };
  });
  return (
    <ResourceView resource={resource}>
      {({ contest, results }) =>
        results ? <ResultsScreen contest={contest} results={results} /> : <ResultsNotReady contestId={contest.id} />
      }
    </ResourceView>
  );
}
