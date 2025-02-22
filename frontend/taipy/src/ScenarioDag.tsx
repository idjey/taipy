import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CanvasWidget } from "@projectstorm/react-canvas-core";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import { ZoomIn } from "@mui/icons-material";
import createEngine from "@projectstorm/react-diagrams";
import deepEqual from "fast-deep-equal/es6";

import { DisplayModel, TaskStatuses } from "./utils/types";
import { addStatusToDisplayModel, createDagreEngine, initDiagram, populateModel, relayoutDiagram } from "./utils/diagram";
import {
    createRequestUpdateAction,
    createSendUpdateAction,
    getUpdateVar,
    useDispatch,
    useDynamicProperty,
    useModule,
} from "taipy-gui";
import { useClassNames } from "./utils";
import { TaipyDiagramModel } from "./projectstorm/models";

interface ScenarioDagProps {
    id?: string;
    defaultScenario?: string;
    scenario?: DisplayModel | DisplayModel[];
    coreChanged?: Record<string, unknown>;
    updateVarName?: string;
    render?: boolean;
    defaultRender?: boolean;
    showToolbar?: boolean;
    width?: string;
    height?: string;
    updateVars: string;
    libClassName?: string;
    className?: string;
    dynamicClassName?: string;
}

const titleSx = { ml: 2, flex: 1 };
const appBarSx = { position: "relative" };

interface DagTitleProps {
    zoomToFit: () => void;
}
const DagTitle = (props: DagTitleProps) => (
    <AppBar sx={appBarSx}>
        <Toolbar>
            <Box sx={titleSx} />
            <Tooltip title="Zoom to fit">
                <IconButton edge="end" color="inherit" onClick={props.zoomToFit}>
                    <ZoomIn />
                </IconButton>
            </Tooltip>
        </Toolbar>
    </AppBar>
);

const getValidScenario = (scenar: DisplayModel | DisplayModel[]) =>
    scenar.length == 3 && typeof scenar[0] === "string"
        ? (scenar as DisplayModel)
        : scenar.length == 1
        ? (scenar[0] as DisplayModel)
        : undefined;

const ScenarioDag = (props: ScenarioDagProps) => {
    const { showToolbar = true } = props;
    const [scenarioId, setScenarioId] = useState("");
    const [engine] = useState(createEngine);
    const [dagreEngine] = useState(createDagreEngine);
    const [displayModel, setDisplayModel] = useState<DisplayModel>();
    const [taskStatuses, setTaskStatuses] = useState<TaskStatuses>();
    const dispatch = useDispatch();
    const module = useModule();

    const render = useDynamicProperty(props.render, props.defaultRender, true);
    const className = useClassNames(props.libClassName, props.dynamicClassName, props.className);

    const sizeSx = useMemo(
        () => ({
            width: props.width || "100%",
            height: props.height || "50vh",
            display: "grid",
            gridTemplateRows: showToolbar ? "auto 1fr" : "1fr",
            gridTemplateColumns: "1fr",
        }),
        [props.width, props.height, showToolbar]
    );

    // Refresh on broadcast
    useEffect(() => {
        const ids = props.coreChanged?.scenario;
        if (typeof ids === "string" ? ids === scenarioId : Array.isArray(ids) ? ids.includes(scenarioId) : ids) {
            props.updateVarName && dispatch(createRequestUpdateAction(props.id, module, [props.updateVarName], true));
        }
        const tasks = props.coreChanged?.tasks;
        if (tasks) {
            setTaskStatuses(tasks as TaskStatuses);
        }
    }, [props.coreChanged, props.updateVarName, scenarioId, module, dispatch, props.id]);

    useEffect(() => {
        let dm: DisplayModel | undefined = undefined;
        if (Array.isArray(props.scenario)) {
            dm = getValidScenario(props.scenario);
        } else if (props.defaultScenario) {
            try {
                dm = getValidScenario(JSON.parse(props.defaultScenario));
            } catch {
                // Do nothing
            }
        }
        dm = addStatusToDisplayModel(dm, taskStatuses);
        setDisplayModel((oldDm) => (deepEqual(oldDm, dm) ? oldDm : dm));
    }, [props.scenario, props.defaultScenario, taskStatuses]);

    const relayout = useCallback(() => relayoutDiagram(engine, dagreEngine), [engine, dagreEngine]);

    const zoomToFit = useCallback(() => engine.zoomToFit(), [engine]);

    useEffect(() => {
        const model = new TaipyDiagramModel();
        initDiagram(engine);
        let doLayout = false;
        if (displayModel) {
            setScenarioId(displayModel[0]);
            // populate model
            doLayout = populateModel(displayModel, model);
        }
        engine.setModel(model);
        // Block deletion
        //engine.getActionEventBus().registerAction(new DeleteItemsAction({ keyCodes: [1] }));
        model.setLocked(true);
        doLayout && setTimeout(relayout, 500);
    }, [displayModel, engine, relayout]);

    useEffect(() => {
        const showVar = getUpdateVar(props.updateVars, "show");
        showVar && dispatch(createSendUpdateAction(showVar, render, module));
    }, [render, props.updateVars, dispatch, module]);

    return render && scenarioId ? (
        <Paper sx={sizeSx} id={props.id} className={className}>
            {showToolbar ? <DagTitle zoomToFit={zoomToFit} /> : null}
            <CanvasWidget engine={engine} />
        </Paper>
    ) : null;
};

export default ScenarioDag;
