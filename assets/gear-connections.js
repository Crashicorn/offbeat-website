/* Offbeat gear-connection model — the one place that decides which lead a
 * controller → speaker path needs.
 *
 * This used to live inside Rig Studio, which meant the guide, the speaker
 * finder and the planner could each drift into their own rule. They now load
 * this file and ask the same question of the same catalogue:
 *
 *   OffbeatGear.connectionPlan(catalog, controller, speaker, boxes)
 *
 * Inputs it understands (see the "schema" block in assets/dj-gear-catalog.json):
 *   controller.outputs[]       {connector, channels, balanced, role, label}
 *   speaker.connection         {topology, feeds_per_box, channels_per_feed, inputs[]}
 *   speaker.included_cables[]  {from, to, feeds_covered, label}
 *   cable.cable                {a, b, channels, b_plugs, balanced, pack_of}
 *
 * The plan separates four things buyers conflate: how many cabinets a purchase
 * contains, how many signal feeds those cabinets need, how many leads must be
 * bought, and which leads are already in the box.
 */
(function (root) {
  "use strict";

var CONNECTOR_LABEL = {
  xlr: "XLR", trs: "1/4\" TRS", ts: "1/4\" TS", rca: "RCA",
  jack35: "3.5 mm", combo_xlr_trs: "combo XLR / 1/4\""
};
function endpointLabel(connector) { return CONNECTOR_LABEL[connector] || connector || "unknown jack"; }
function isBalancedConnector(connector) {
  return connector === "xlr" || connector === "trs" || connector === "combo_xlr_trs";
}

/* A socket accepts a plug, never the other way round: a TRS jack takes a TS
   plug, but a TS jack cannot carry a balanced signal. */
function inputAcceptsPlug(socket, plug) {
  if (!socket || !plug) return false;
  if (socket === plug) return true;
  if (socket === "combo_xlr_trs") return plug === "xlr" || plug === "trs" || plug === "ts";
  if (socket === "trs") return plug === "ts" || plug === "trs";
  return false;
}
function outputFeedsPlug(outputConnector, plug) {
  if (!outputConnector || !plug) return false;
  if (outputConnector === plug) return true;
  /* A TRS output can drive a TS plug, losing the balanced benefit. */
  if (outputConnector === "trs") return plug === "ts";
  return false;
}
function controllerOutputs(item) {
  return (item && Array.isArray(item.outputs)) ? item.outputs.filter(function (o) { return o && o.connector; }) : [];
}
function speakerOutputSockets(item) {
  return (item && item.connection && Array.isArray(item.connection.inputs)) ? item.connection.inputs.filter(function (s) { return s && s.connector; }) : [];
}

/* Package quantities. A retail box may hold two cabinets, and one cabinet
   may carry a stereo input pair or a single mono channel. */
function speakerUnitsOf(item) {
  return Math.max(1, Math.round(Number(item && item.speaker_units)) || 1);
}
function feedShape(item, qty) {
  var conn = (item && item.connection) || {};
  var feedsPerBox = Math.max(1, Math.round(Number(conn.feeds_per_box)) || 1);
  var boxes = Math.max(1, Math.round(Number(qty) || 1));
  return {
    topology: conn.topology || "independent",
    feedsPerBox: feedsPerBox,
    feeds: feedsPerBox * boxes,
    cabinets: speakerUnitsOf(item) * boxes,
    channelsPerFeed: Number(conn.channels_per_feed) === 1 ? 1 : 2
  };
}
/* One purchase can carry two speaker-end plugs, so it can serve either one
   stereo feed or two mono feeds — never more. */
function cableUnitsFor(feeds, channelsPerFeed, cable) {
  if (channelsPerFeed >= 2) return feeds;
  var plugs = Math.max(1, Math.round(Number(cable && cable.b_plugs) || 2));
  return Math.ceil(feeds / plugs);
}
function cableProducts(catalog) {
  return ((catalog && catalog.items) || []).filter(function (i) {
    return i.category === "cables" && i.cable && !isEstimateItem(i);
  });
}
function cableAllowances(catalog) {
  return ((catalog && catalog.items) || []).filter(function (i) {
    return i.category === "cables" && i.cable && isEstimateItem(i);
  });
}
/* Catalogue lines that are planning allowances rather than verified products:
   they carry a cost, but never a retailer SKU or affiliate link. */
function isEstimateItem(item) {
  return Boolean(item && (item.estimate_only === true || item.no_retailer_link === true));
}

function routeScore(output, socket, cable, socketIsNative) {
  var score = 0;
  if (cable.balanced && output.balanced && socket.balanced) score += 6;
  if (cable.a === output.connector) score += 3;
  if (socketIsNative) score += 2;
  if (socket.connector === "combo_xlr_trs" && (cable.b === "xlr" || cable.b === "trs")) score += 2;
  if (output.role === "master") score += 2;
  if (!output.balanced) score -= 1;
  if (!cable.balanced) score -= 1;
  /* An XLR plug is the balanced format. Sending an unbalanced signal down XLR
     plugs is the unusual case, so prefer a 1/4-inch or combo jack when the
     signal is unbalanced and both would fit. */
  if (!cable.balanced && cable.b === "xlr") score -= 3;
  return score;
}

/* The whole answer for one controller → speaker-box path. */
function connectionPlan(catalog, controller, speaker, qty) {
  var shape = feedShape(speaker, qty);
  var plan = {
    speaker: speaker, topology: shape.topology, feeds: shape.feeds,
    feedsPerBox: shape.feedsPerBox, cabinets: shape.cabinets,
    channelsPerFeed: shape.channelsPerFeed,
    kind: "unknown", itemId: null, units: 0, coveredFeeds: 0,
    name: "cable you will need to confirm", label: "check jacks",
    short: "confirm the jacks", output: null, socket: null,
    balanced: false, alsoIncluded: false, includedLabel: "", note: ""
  };
  if (!controller || !speaker) return plan;
  var outs = controllerOutputs(controller);
  var sockets = speakerOutputSockets(speaker);
  if (!outs.length || !sockets.length) {
    plan.note = "Our catalogue has no socket list for this pairing yet.";
    return plan;
  }

  /* Count the feeds a lead in the box already covers. A purchase is only
     needed for whatever is left over. */
  var includedRoute = null;
  (speaker.included_cables || []).forEach(function (inc) {
    outs.forEach(function (out) {
      if (!outputFeedsPlug(out.connector, inc.from)) return;
      sockets.forEach(function (socket) {
        if (!inputAcceptsPlug(socket.connector, inc.to)) return;
        if (Number(socket.channels || 1) < shape.channelsPerFeed) return;
        var score = (out.role === "master" ? 2 : 0) + (out.connector === inc.from ? 2 : 0);
        if (!includedRoute || score > includedRoute.score) {
          includedRoute = { score: score, inc: inc, output: out, socket: socket };
        }
      });
    });
  });
  if (includedRoute) {
    plan.coveredFeeds = Math.min(shape.feeds, Math.max(0, Number(includedRoute.inc.feeds_covered) || 1) * Math.max(1, Math.round(Number(qty) || 1)));
    plan.includedLabel = includedRoute.inc.label || "the lead supplied in the box";
    plan.output = includedRoute.output;
    plan.socket = includedRoute.socket;
    plan.kind = "included";
    plan.label = endpointLabel(includedRoute.inc.from) + " → " + endpointLabel(includedRoute.inc.to);
    plan.short = endpointLabel(includedRoute.inc.to);
    plan.name = plan.includedLabel;
  }

  var remainingFeeds = shape.feeds - plan.coveredFeeds;
  if (remainingFeeds <= 0) {
    plan.units = 0;
    plan.note = (speaker.included_cables || []).length
      ? "Already in the box: " + plan.includedLabel + ". Nothing to buy for this path."
      : "Nothing to buy for this path.";
    return plan;
  }

  var best = null;
  cableProducts(catalog).forEach(function (item) {
    var cable = item.cable;
    outs.forEach(function (out) {
      if (!outputFeedsPlug(out.connector, cable.a)) return;
      sockets.forEach(function (socket) {
        if (!inputAcceptsPlug(socket.connector, cable.b)) return;
        if (Number(socket.channels || 1) < shape.channelsPerFeed) return;
        var score = routeScore(out, socket, cable, cable.b === socket.connector);
        if (!best || score > best.score) best = { score: score, item: item, cable: cable, output: out, socket: socket };
      });
    });
  });

  var allowance = null;
  if (!best) {
    cableAllowances(catalog).forEach(function (item) {
      var cable = item.cable;
      var balancedCable = isBalancedConnector(cable.a) && isBalancedConnector(cable.b);
      outs.forEach(function (out) {
        if (!outputFeedsPlug(out.connector, cable.a)) return;
        sockets.forEach(function (socket) {
          if (!inputAcceptsPlug(socket.connector, cable.b)) return;
          if (Number(socket.channels || 1) < shape.channelsPerFeed) return;
          var score = routeScore(out, socket, { a: cable.a, b: cable.b, balanced: balancedCable }, cable.b === socket.connector);
          if (!allowance || score > allowance.score) allowance = { score: score, item: item, cable: cable, output: out, socket: socket, balanced: balancedCable };
        });
      });
    });
  }

  var chosen = best || allowance;
  if (!chosen) {
    plan.note = "No lead in our catalogue matches " + controller.model + " → " + speaker.model +
      ". Confirm the jacks before ordering.";
    return plan;
  }

  var cable = chosen.cable;
  plan.itemId = chosen.item.id;
  plan.output = chosen.output;
  plan.socket = chosen.socket;
  plan.kind = best ? "product" : "allowance";
  plan.balanced = best ? Boolean(cable.balanced) : Boolean(chosen.balanced);
  plan.label = endpointLabel(cable.a) + " → " + endpointLabel(cable.b);
  plan.short = endpointLabel(cable.b);
  plan.name = best ? chosen.item.model : endpointLabel(cable.a) + " to " + endpointLabel(cable.b);
  plan.units = cableUnitsFor(remainingFeeds, shape.channelsPerFeed, cable);
  plan.alsoIncluded = plan.coveredFeeds > 0;
  var feedSentence = shape.topology === "master_slave"
    ? "One lead feeds both cabinets: the powered cabinet carries every input and drives the passive one."
    : shape.feeds === 1
      ? "This one cabinet is a single feed, so it plays in mono."
      : "Each cabinet is powered on its own, so both need a feed: one dual lead reaches " + shape.feeds + " cabinets with one plug each.";
  /* A box can include leads that are the wrong shape for this output. Say so,
     otherwise the buyer cannot tell a spare from a substitute. */
  var boxLabels = (speaker.included_cables || []).map(function (inc) {
    return inc.label || (endpointLabel(inc.from) + " to " + endpointLabel(inc.to));
  });
  var boxNote = (!plan.alsoIncluded && boxLabels.length)
    ? " The box's " + boxLabels.join(" and ") + " cannot connect this output, so it does not replace this lead."
    : "";
  plan.note = feedSentence +
    (plan.alsoIncluded ? " " + plan.coveredFeeds + " of " + shape.feeds + " feeds already come with " + plan.includedLabel + "." : "") +
    boxNote +
    (plan.kind === "allowance" ? " Offbeat has no verified product for this socket pair, so it is a priced allowance." : "") +
    (!plan.balanced && chosen.socket.balanced
      ? " The lead is unbalanced; it fits a balanced input without making the signal balanced."
      : "");
  return plan;
}

  root.OffbeatGear = {
    CONNECTOR_LABEL: CONNECTOR_LABEL,
    endpointLabel: endpointLabel,
    isBalancedConnector: isBalancedConnector,
    inputAcceptsPlug: inputAcceptsPlug,
    outputFeedsPlug: outputFeedsPlug,
    controllerOutputs: controllerOutputs,
    speakerOutputSockets: speakerOutputSockets,
    speakerUnitsOf: speakerUnitsOf,
    feedShape: feedShape,
    cableUnitsFor: cableUnitsFor,
    cableProducts: cableProducts,
    cableAllowances: cableAllowances,
    isEstimateItem: isEstimateItem,
    routeScore: routeScore,
    connectionPlan: connectionPlan
  };
})(typeof window !== "undefined" ? window : this);
