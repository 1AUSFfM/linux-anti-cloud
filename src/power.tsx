/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Suspend policy surface — milestone B5.
 *
 * The reasoning behind this page lives in the governing plan, outside this
 * repository; see CLAUDE.md for how to reach it.
 *
 * DESIGN NOTE, and it is the reason this page exists at all:
 * we read **logind**, not our own daemon. The page shows what the machine
 * actually reports, so a lock taken by anything else -- a hand-run
 * systemd-inhibit, PowerDevil, a package manager -- is equally visible, and
 * smb-suspend-guard appears as one inhibitor among several, which is what it
 * really is. A surface that rendered only our daemon's opinion would agree
 * with itself and disagree with the machine.
 *
 * BlockInhibited is a property with emits-change, so it is subscribed rather
 * than polled. ListInhibitors() returns a(ssssuu): what, who, why, mode, uid, pid.
 */

import React, { useEffect, useState } from 'react';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import {
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
} from "@patternfly/react-core/dist/esm/components/DescriptionList/index.js";
import { Label } from "@patternfly/react-core/dist/esm/components/Label/index.js";
import { Page, PageSection } from '@patternfly/react-core/dist/esm/components/Page/index.js';
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';

import cockpit from 'cockpit';

const _ = cockpit.gettext;

const GUARD_UNIT = "smb-suspend-guard.service";
const GUARD_WHO = "smb-suspend-guard";

interface Inhibitor {
    what: string;
    who: string;
    why: string;
    mode: string;
    uid: number;
    pid: number;
}

const SleepCard = ({ blocked, mine }: { blocked: boolean, mine?: Inhibitor }) => {
    const title = blocked
        ? _("Suspend is blocked — this host will not sleep")
        : _("Suspend is allowed — this host may sleep when idle");

    let detail = _("No process is holding a sleep lock. Clients with files open would take one.");
    if (blocked && mine)
        detail = cockpit.format(_("Held by $0: $1"), mine.who, mine.why);
    else if (blocked)
        detail = _("Held by something other than the share guard — see the table below.");

    return (
        <Card>
            <CardTitle>{_("Suspend")}</CardTitle>
            <CardBody>
                <Alert isInline variant={blocked ? "warning" : "success"} title={title}>
                    {detail}
                </Alert>
            </CardBody>
        </Card>
    );
};

const InhibitorRow = ({ item }: { item: Inhibitor }) => {
    const who = item.who === GUARD_WHO ? <Label color="blue">{item.who}</Label> : item.who;
    const mode = item.mode === "block"
        ? <Label color="orange" isCompact>{item.mode}</Label>
        : <Label isCompact>{item.mode}</Label>;

    return (
        <Tr>
            <Td>{who}</Td>
            <Td>{item.what}</Td>
            <Td>{item.why}</Td>
            <Td>{mode}</Td>
            <Td>{item.pid}</Td>
        </Tr>
    );
};

const InhibitorsCard = ({ inhibitors }: { inhibitors: Inhibitor[] }) => {
    let body = <p>{_("None. Nothing is inhibiting power operations.")}</p>;

    if (inhibitors.length > 0) {
        body = (
            <Table variant="compact">
                <Thead>
                    <Tr>
                        <Th>{_("Who")}</Th>
                        <Th>{_("What")}</Th>
                        <Th>{_("Why")}</Th>
                        <Th>{_("Mode")}</Th>
                        <Th>{_("PID")}</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {inhibitors.map(i => <InhibitorRow key={`${i.pid}-${i.what}`} item={i} />)}
                </Tbody>
            </Table>
        );
    }

    return (
        <Card>
            <CardTitle>{_("Active inhibitors")}</CardTitle>
            <CardBody>{body}</CardBody>
        </Card>
    );
};

interface GuardProps {
    active: string;
    enabled: string;
    busy: boolean;
    error: string | null;
    onAction: (verb: string) => void;
}

const GuardCard = ({ active, enabled, busy, error, onAction }: GuardProps) => {
    const running = active === "active";
    const alert = error ? <Alert isInline variant="danger" title={error} /> : null;

    return (
        <Card>
            <CardTitle>{_("Share suspend guard")}</CardTitle>
            <CardBody>
                {alert}
                <DescriptionList isHorizontal>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Unit")}</DescriptionListTerm>
                        <DescriptionListDescription>{GUARD_UNIT}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("State")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            <Label color={running ? "green" : "red"}>{active || _("unknown")}</Label>
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("At boot")}</DescriptionListTerm>
                        <DescriptionListDescription>{enabled || _("unknown")}</DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>
                <br />
                <Button
                    variant="secondary"
                    isDisabled={busy}
                    onClick={() => onAction(running ? "stop" : "start")}
                >
                    {running ? _("Stop guard") : _("Start guard")}
                </Button>
            </CardBody>
        </Card>
    );
};

export const PowerPage = () => {
    const [blocked, setBlocked] = useState(false);
    const [inhibitors, setInhibitors] = useState<Inhibitor[]>([]);
    const [active, setActive] = useState("");
    const [enabled, setEnabled] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const dbus = cockpit.dbus("org.freedesktop.login1", { bus: "system" });
        const manager = dbus.proxy("org.freedesktop.login1.Manager", "/org/freedesktop/login1");

        const refreshList = () => {
            manager.call("ListInhibitors", [])
                    .then((reply: [Array<[string, string, string, string, number, number]>]) => {
                        const rows = reply[0].map(r => ({
                            what: r[0], who: r[1], why: r[2], mode: r[3], uid: r[4], pid: r[5],
                        }));
                        setInhibitors(rows);
                    })
                    .catch((ex: Error) => setError(ex.message));
        };

        const onChanged = () => {
            /* "sleep" in BlockInhibited is the machine's own answer to "will this
             * host suspend?" -- not our daemon's belief about it. */
            const bi: string = manager.BlockInhibited || "";
            setBlocked(bi.split(":").includes("sleep"));
            refreshList();
        };

        manager.addEventListener("changed", onChanged);
        manager.wait(onChanged);

        return () => {
            manager.removeEventListener("changed", onChanged);
            dbus.close();
        };
    }, []);

    const refreshUnit = () => {
        cockpit.spawn(["systemctl", "is-active", GUARD_UNIT], { err: "out" })
                .then((s: string) => setActive(s.trim()))
                .catch(() => setActive("inactive"));
        cockpit.spawn(["systemctl", "is-enabled", GUARD_UNIT], { err: "out" })
                .then((s: string) => setEnabled(s.trim()))
                .catch(() => setEnabled("unknown"));
    };

    useEffect(refreshUnit, []);

    const onAction = (verb: string) => {
        setBusy(true);
        setError(null);
        cockpit.spawn(["systemctl", verb, GUARD_UNIT], { superuser: "require", err: "message" })
                .then(refreshUnit)
                .catch((ex: Error) => setError(ex.message))
                .finally(() => setBusy(false));
    };

    const mine = inhibitors.find(i => i.who === GUARD_WHO && i.what.split(":").includes("sleep"));

    return (
        <Page className='pf-m-no-sidebar'>
            <PageSection>
                <Stack hasGutter>
                    <StackItem>
                        <SleepCard blocked={blocked} mine={mine} />
                    </StackItem>
                    <StackItem>
                        <GuardCard
                            active={active}
                            enabled={enabled}
                            busy={busy}
                            error={error}
                            onAction={onAction}
                        />
                    </StackItem>
                    <StackItem>
                        <InhibitorsCard inhibitors={inhibitors} />
                    </StackItem>
                </Stack>
            </PageSection>
        </Page>
    );
};
