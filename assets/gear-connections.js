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
  if (output.role === "booth") score += 1;
  if (!output.balanced) score -= 1;
  if (!cable.balanced) score -= 1;
  /* An XLR plug is the balanced format. Sending an unbalanced signal down XLR
     plugs is the unusual case, so prefer a 1/4-inch or combo jack when the
     signal is unbalanced and both would fit. */
  if (!cable.balanced && cable.b === "xlr") score -= 3;
  /* Prefer the documented orientation when both ends would physically fit. */
  if (cable.reversed) score -= 1;
  return score;
}

/* ------------------------------------------------------------ assemblies
   A lead is two plugs on a conductor. A dual RCA to 3.5 mm adapter cable is
   not a one-way device: the same plugs carry the signal either way round,
   which is exactly how a DDJ-FLX4's RCA master reaches the DM-40D's 3.5 mm
   input through the converter Pioneer puts in the box. Anything with
   electronics inside it (a DI box, an active converter, a USB audio adapter)
   is directional, and the catalogue marks those explicitly. */
function isReversibleAssembly(lead) {
  if (!lead) return false;
  if (lead.directional === true) return false;
  if (lead.reversible === false) return false;
  return true;
}
/* Every way this lead can legitimately be plugged in. A symmetric lead has one
   orientation only, so it is not listed twice. */
function leadOrientations(lead) {
  var forward = { from: lead.from, to: lead.to, reversed: false };
  if (!isReversibleAssembly(lead) || lead.from === lead.to) return [forward];
  return [forward, { from: lead.to, to: lead.from, reversed: true }];
}
/* Flip a cable product so its "source" end is the plug we actually have. The
   plug counts travel with the ends, so lead-quantity maths stays correct. */
function orientedCable(cable, reversed) {
  if (!reversed) return cable;
  var flipped = {};
  Object.keys(cable).forEach(function (key) { flipped[key] = cable[key]; });
  flipped.a = cable.b;
  flipped.b = cable.a;
  flipped.a_plugs = cable.b_plugs;
  flipped.b_plugs = cable.a_plugs;
  flipped.reversed = true;
  return flipped;
}
function cableOrientations(cable) {
  var forward = orientedCable(cable, false);
  if (!isReversibleAssembly(cable) || cable.a === cable.b) return [forward];
  return [forward, orientedCable(cable, true)];
}
/* Plain-language list of what the deck can actually feed, used when a rig
   asks for more stereo destinations than the hardware has. */
function describeOutputs(controller) {
  var outs = controllerOutputs(controller);
  if (!outs.length) return "no listed master output";
  return outs.map(function (out) {
    return (out.label || endpointLabel(out.connector)) + (out.role === "booth" ? " (booth)" : "");
  }).join(" and ");
}

/* ------------------------------------------------------- output capacity
   Every entry in controller.outputs is one physical socket. A second speaker
   line cannot use a socket that is already feeding another one unless the
   buyer adds a splitter, and Offbeat has no verified splitter for sale, so the
   model reports the gap instead of pricing a lead that cannot solve it.
   `options.sockets` may override the default of one socket per output when a
   catalogue entry documents something different. */
function outputCapacity(controller, options) {
  var override = (options && options.sockets) || {};
  var capacity = {};
  controllerOutputs(controller).forEach(function (out) {
    capacity[out.connector] = (capacity[out.connector] || 0) + Math.max(1, Math.round(Number(override[out.connector]) || 1));
  });
  return capacity;
}

/* The whole answer for one controller → speaker-box path.
 *
 * `options.usedOutputs` is how many sockets of each connector the other
 * speaker lines in the same rig have already claimed. */
function connectionPlan(catalog, controller, speaker, qty, options) {
  var shape = feedShape(speaker, qty);
  var boxes = Math.max(1, Math.round(Number(qty) || 1));
  var plan = {
    speaker: speaker, topology: shape.topology, feeds: shape.feeds,
    feedsPerBox: shape.feedsPerBox, cabinets: shape.cabinets,
    channelsPerFeed: shape.channelsPerFeed,
    kind: "unknown", itemId: null, units: 0, coveredFeeds: 0,
    name: "cable you will need to confirm", label: "check jacks",
    short: "confirm the jacks", output: null, socket: null,
    balanced: false, alsoIncluded: false, includedLabel: "", note: "",
    outputsNeeded: 1, reversedLead: false, conflict: false, capacity: 0
  };
  if (!controller || !speaker) return plan;
  var outs = controllerOutputs(controller);
  var sockets = speakerOutputSockets(speaker);
  if (!outs.length || !sockets.length) {
    plan.note = "Our catalogue has no socket list for this pairing yet.";
    return plan;
  }

  /* 1. Does a lead in the box already carry this signal? Passive assemblies
        work in either direction, so both orientations count. Check cables
        included with the speaker or the controller. */
  var includedRoute = null;
  var allIncluded = (speaker.included_cables || []).concat(controller.included_cables || []);
  allIncluded.forEach(function (inc) {
    leadOrientations(inc).forEach(function (orient) {
      outs.forEach(function (out) {
        if (!outputFeedsPlug(out.connector, orient.from)) return;
        sockets.forEach(function (socket) {
          if (!inputAcceptsPlug(socket.connector, orient.to)) return;
          if (Number(socket.channels || 1) < shape.channelsPerFeed) return;
          var score = (out.role === "master" ? 2 : 0) + (out.connector === orient.from ? 2 : 0) - (orient.reversed ? 1 : 0);
          if (!includedRoute || score > includedRoute.score) {
            includedRoute = { score: score, inc: inc, orient: orient, output: out, socket: socket };
          }
        });
      });
    });
  });
  /* One retail box ships one lead, and one lead uses one output socket. A
     second box cannot cover a second feed from the same socket just because it
     brought its own lead, so coverage is capped by the leads one box can
     actually plug in, not by the box count. */
  var leadFeeds = includedRoute ? Math.max(1, Number(includedRoute.inc.feeds_covered) || 1) : 0;
  var includedLeadsUsed = includedRoute ? Math.min(Math.ceil(shape.feeds / leadFeeds), boxes) : 0;
  var coveredFeeds = Math.min(shape.feeds, includedLeadsUsed * leadFeeds);
  var remainingFeeds = shape.feeds - coveredFeeds;

  var capacity = outputCapacity(controller, options);
  var used = (options && options.usedOutputs) || {};
  function freeSockets(connector) {
    return (capacity[connector] || 0) - (used[connector] || 0);
  }
  function isOutputAvailable(out, needed) {
    if (freeSockets(out.connector) < (needed || 1)) return false;
    if (used.claimed && used.claimed.indexOf(out) !== -1) return false;
    var sameConnectorOuts = outs.filter(function (o) { return o.connector === out.connector; });
    if (sameConnectorOuts.length > 1) {
      var currentUsed = used[out.connector] || 0;
      var rank = sameConnectorOuts.indexOf(out);
      if (rank < currentUsed) return false;
    }
    return true;
  }

  /* 2. Build every route the catalogue can actually make: a verified product
        first, then a priced allowance for socket pairs with no verified SKU. */
  var candidates = [];
  function addCandidate(score, item, cable, out, socket, isAllowance) {
    var units = cableUnitsFor(remainingFeeds, shape.channelsPerFeed, cable);
    candidates.push({
      score: score, item: item, cable: cable, output: out, socket: socket,
      allowance: Boolean(isAllowance), units: units,
      /* The included lead (if any) takes one socket, then each purchased lead
         takes one more. */
      socketsNeeded: (coveredFeeds > 0 ? 1 : 0) + units
    });
  }
  if (remainingFeeds > 0) {
    cableProducts(catalog).forEach(function (item) {
      cableOrientations(item.cable).forEach(function (cable) {
        outs.forEach(function (out) {
          if (!outputFeedsPlug(out.connector, cable.a)) return;
          sockets.forEach(function (socket) {
            if (!inputAcceptsPlug(socket.connector, cable.b)) return;
            if (Number(socket.channels || 1) < shape.channelsPerFeed) return;
            addCandidate(routeScore(out, socket, cable, cable.b === socket.connector) + 1, item, cable, out, socket, false);
          });
        });
      });
    });
  }
  var fitsVerified = candidates.filter(function (c) { return isOutputAvailable(c.output, c.socketsNeeded); });
  if (!fitsVerified.length && remainingFeeds > 0) {
    cableAllowances(catalog).forEach(function (item) {
      cableOrientations(item.cable).forEach(function (raw) {
        var balanced = isBalancedConnector(raw.a) && isBalancedConnector(raw.b);
        var cable = { a: raw.a, b: raw.b, balanced: balanced, reversed: raw.reversed };
        outs.forEach(function (out) {
          if (!outputFeedsPlug(out.connector, cable.a)) return;
          sockets.forEach(function (socket) {
            if (!inputAcceptsPlug(socket.connector, cable.b)) return;
            if (Number(socket.channels || 1) < shape.channelsPerFeed) return;
            addCandidate(routeScore(out, socket, cable, cable.b === socket.connector), item, cable, out, socket, true);
          });
        });
      });
    });
  }

  /* 3. Ranking. The included lead wins outright when it covers everything;
        otherwise the best-scoring purchasable route is preferred. */
  candidates.sort(function (a, b) { return b.score - a.score; });

  var includedCandidate = includedRoute ? {
    score: includedRoute.score + 3, item: null, cable: null,
    output: includedRoute.output, socket: includedRoute.socket,
    allowance: false, included: true, units: 0,
    socketsNeeded: includedLeadsUsed +
      (remainingFeeds > 0 ? cableUnitsFor(remainingFeeds, shape.channelsPerFeed, { b_plugs: 2 }) : 0)
  } : null;

  var pool = [];
  if (includedCandidate) pool.push(includedCandidate);
  candidates.forEach(function (c) { pool.push(c); });

  var fits = pool.filter(function (c) { return isOutputAvailable(c.output, c.socketsNeeded); });
  /* When nothing fits we still want to explain the best route's socket path. */
  var chosen = fits[0] || null;
  var blocked = chosen ? null : (pool[0] || null);

  if (blocked) {
    plan.kind = "unresolved";
    plan.conflict = true;
    plan.output = blocked.output;
    plan.socket = blocked.socket;
    plan.outputsNeeded = blocked.socketsNeeded;
    plan.reversedLead = Boolean(blocked.cable && blocked.cable.reversed);
    plan.capacity = capacity[blocked.output.connector] || 0;
    plan.label = endpointLabel(blocked.output.connector) + " \u2192 " + endpointLabel(blocked.socket.connector);
    plan.short = endpointLabel(blocked.socket.connector);
    plan.name = "a second stereo feed this deck does not have";
    var outLabel = blocked.output.label || endpointLabel(blocked.output.connector);
    var busy = (used[blocked.output.connector] || 0) > 0;
    /* A deck can own other master sockets and still leave this line stranded:
       say which ones stay free, so the sentence never reads "it has only one
       output" when the deck plainly has three. */
    var otherOuts = controllerOutputs(controller).filter(function (o) {
      return o.connector !== blocked.output.connector;
    });
    var otherNote = !otherOuts.length ? "" :
      " The deck's " + otherOuts.map(function (o) { return o.label || endpointLabel(o.connector); }).join(" and ") +
      " stay free, but Offbeat has no verified lead from " + (otherOuts.length > 1 ? "those outputs" : "that output") +
      " to these inputs, so nothing is priced for it.";
    plan.note = blocked.socketsNeeded > 1
      ? "This line needs " + blocked.socketsNeeded + " leads, and each lead needs its own " + endpointLabel(blocked.output.connector) +
        " socket. " + controller.model + " has " + capacity[blocked.output.connector] + " \u00d7 " + outLabel +
        ". Splitting one output across several leads needs a distribution box; Offbeat has no verified splitter, so no lead is priced here and the routing stays unresolved."
      : "This line needs its own stereo feed, but " + controller.model + "'s " + outLabel +
        (busy ? " is already feeding another speaker line." : " is the only one it has.") +
        " A second pair needs its own output or a splitter; Offbeat has no verified splitter, so no lead is priced here and the routing stays unresolved." +
        " The headphone socket is for cueing, not a second master, so it cannot stand in for one.";
    plan.note += otherNote;
    return plan;
  }

  if (!chosen) {
    if (remainingFeeds <= 0) {
      plan.note = "Nothing to buy for this path.";
      plan.kind = "unknown";
      return plan;
    }
    plan.note = "No lead in our catalogue matches " + controller.model + " \u2192 " + speaker.model +
      ". Confirm the jacks before ordering.";
    return plan;
  }

  plan.output = chosen.output;
  plan.socket = chosen.socket;
  plan.coveredFeeds = coveredFeeds;
  plan.outputsNeeded = chosen.socketsNeeded;
  plan.capacity = capacity[chosen.output.connector] || 0;

  if (chosen.included) {
    plan.kind = "included";
    plan.includedLabel = includedRoute.inc.label || "the lead supplied in the box";
    plan.reversedLead = Boolean(includedRoute.orient.reversed);
    plan.label = endpointLabel(chosen.output.connector) + " \u2192 " + endpointLabel(chosen.socket.connector);
    plan.short = endpointLabel(chosen.socket.connector);
    plan.name = plan.includedLabel;
    plan.units = 0;
    plan.note = "Already in the box: " + plan.includedLabel +
      (plan.reversedLead ? " \u2014 a passive lead, so it works either way round" : "") +
      ". Nothing to buy for this path. Check the supplied lead reaches your desk; add a longer one only if it does not.";
    return plan;
  }

  var cable = chosen.cable;
  plan.itemId = chosen.item.id;
  plan.kind = chosen.allowance ? "allowance" : "product";
  plan.balanced = Boolean(cable.balanced);
  plan.reversedLead = Boolean(cable.reversed);
  plan.label = endpointLabel(cable.a) + " \u2192 " + endpointLabel(cable.b);
  plan.short = endpointLabel(cable.b);
  plan.name = chosen.allowance ? endpointLabel(cable.a) + " to " + endpointLabel(cable.b) : chosen.item.model;
  plan.units = chosen.units;
  plan.alsoIncluded = coveredFeeds > 0;

  var feedSentence = shape.topology === "master_slave"
    ? "One lead feeds both cabinets: the powered cabinet carries every input and drives the passive one."
    : shape.feeds === 1
      ? "This one cabinet is a single feed, so it plays in mono."
      : shape.feeds === 2 && plan.units === 1
        ? "Each cabinet is powered on its own, so both need a feed: one dual lead reaches them with one plug each."
        : shape.feeds + " independently powered cabinets need " + plan.units + " leads: one plug into each cabinet.";
  /* A box can include leads that are the wrong shape for this output. Say so,
     otherwise the buyer cannot tell a spare from a substitute. */
  var allBoxCables = (speaker.included_cables || []).concat(controller.included_cables || []);
  var boxLabels = allBoxCables.map(function (inc) {
    return inc.label || (endpointLabel(inc.from) + " to " + endpointLabel(inc.to));
  });
  var boxNote = (!plan.alsoIncluded && boxLabels.length)
    ? " The box's " + boxLabels.join(" and ") + " cannot connect this output, so it does not replace this lead."
    : "";
  plan.note = feedSentence +
    (plan.alsoIncluded ? " " + coveredFeeds + " of " + shape.feeds + " feeds already come with " + plan.includedLabel + "." : "") +
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
    isReversibleAssembly: isReversibleAssembly,
    leadOrientations: leadOrientations,
    describeOutputs: describeOutputs,
    outputCapacity: outputCapacity,
    connectionPlan: connectionPlan
  };
})(typeof window !== "undefined" ? window : this);
