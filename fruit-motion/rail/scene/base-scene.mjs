// Sealed B00 source scene (SHA 2afde931b44d788786e5887bdbbabe86f3979b9afa211b81db815cd726445925).
export default {
  "schema": "rail-common-scene/v1",
  "seed": 20261125,
  "width": 1280,
  "height": 720,
  "dpr": 1,
  "coordinateSystem": "right-handed; y-up; camera positive z looking toward -z",
  "clearColor": "#d5e8c7",
  "camera": {
    "position": [
      0,
      4.8,
      7.8
    ],
    "target": [
      0,
      1.35,
      -17
    ],
    "fov": 55,
    "near": 0.1,
    "far": 90
  },
  "lights": {
    "ambient": {
      "color": "#ffffff",
      "intensity": 0.55
    },
    "directional": {
      "color": "#fff4df",
      "intensity": 1.0,
      "position": [
        -8,
        12,
        6
      ]
    }
  },
  "settings": {
    "shadow": false,
    "postProcessing": false,
    "antialias": true,
    "toneMapping": "none",
    "renderClockHz": 60,
    "nearEndZ": 5,
    "farEndZ": -70
  },
  "dimensionConvention": {
    "box": "[width,height,depth]",
    "sphere": "[radius,horizontalSegments,verticalSegments]",
    "cylinder": "[topRadius,bottomRadius,height,segments]",
    "cone": "[radius,height,segments]",
    "angles": "radians XYZ"
  },
  "meshes": [
    {
      "id": "grass",
      "shape": "box",
      "position": [
        0,
        -0.16,
        -33
      ],
      "dimensions": [
        32,
        0.3,
        75
      ],
      "color": "#496e35",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "road_0",
      "shape": "box",
      "position": [
        -2.7,
        0.015,
        -33
      ],
      "dimensions": [
        2.36,
        0.06,
        74
      ],
      "color": "#987753",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "rail_0_-1",
      "shape": "box",
      "position": [
        -3.39,
        0.1,
        -33
      ],
      "dimensions": [
        0.085,
        0.12,
        74
      ],
      "color": "#aab1b2",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "rail_0_1",
      "shape": "box",
      "position": [
        -2.0100000000000002,
        0.1,
        -33
      ],
      "dimensions": [
        0.085,
        0.12,
        74
      ],
      "color": "#aab1b2",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_0",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        2.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_1",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        0.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_2",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -2.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_3",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -4.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_4",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -6.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_5",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -8.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_6",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -11.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_7",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -13.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_8",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -15.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_9",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -17.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_10",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -20.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_11",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -22.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_12",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -24.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_13",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -26.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_14",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -29.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_15",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -31.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_16",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -33.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_17",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -35.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_18",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -38.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_19",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -40.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_20",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -42.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_21",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -44.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_22",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -47.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_23",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -49.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_24",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -51.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_25",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -53.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_26",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -56.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_27",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -58.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_28",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -60.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_29",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -62.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_30",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -65.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_0_31",
      "shape": "box",
      "position": [
        -2.7,
        0.045,
        -67.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "road_1",
      "shape": "box",
      "position": [
        0,
        0.015,
        -33
      ],
      "dimensions": [
        2.36,
        0.06,
        74
      ],
      "color": "#987753",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "rail_1_-1",
      "shape": "box",
      "position": [
        -0.69,
        0.1,
        -33
      ],
      "dimensions": [
        0.085,
        0.12,
        74
      ],
      "color": "#aab1b2",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "rail_1_1",
      "shape": "box",
      "position": [
        0.69,
        0.1,
        -33
      ],
      "dimensions": [
        0.085,
        0.12,
        74
      ],
      "color": "#aab1b2",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_0",
      "shape": "box",
      "position": [
        0,
        0.045,
        2.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_1",
      "shape": "box",
      "position": [
        0,
        0.045,
        0.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_2",
      "shape": "box",
      "position": [
        0,
        0.045,
        -2.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_3",
      "shape": "box",
      "position": [
        0,
        0.045,
        -4.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_4",
      "shape": "box",
      "position": [
        0,
        0.045,
        -6.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_5",
      "shape": "box",
      "position": [
        0,
        0.045,
        -8.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_6",
      "shape": "box",
      "position": [
        0,
        0.045,
        -11.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_7",
      "shape": "box",
      "position": [
        0,
        0.045,
        -13.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_8",
      "shape": "box",
      "position": [
        0,
        0.045,
        -15.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_9",
      "shape": "box",
      "position": [
        0,
        0.045,
        -17.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_10",
      "shape": "box",
      "position": [
        0,
        0.045,
        -20.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_11",
      "shape": "box",
      "position": [
        0,
        0.045,
        -22.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_12",
      "shape": "box",
      "position": [
        0,
        0.045,
        -24.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_13",
      "shape": "box",
      "position": [
        0,
        0.045,
        -26.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_14",
      "shape": "box",
      "position": [
        0,
        0.045,
        -29.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_15",
      "shape": "box",
      "position": [
        0,
        0.045,
        -31.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_16",
      "shape": "box",
      "position": [
        0,
        0.045,
        -33.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_17",
      "shape": "box",
      "position": [
        0,
        0.045,
        -35.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_18",
      "shape": "box",
      "position": [
        0,
        0.045,
        -38.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_19",
      "shape": "box",
      "position": [
        0,
        0.045,
        -40.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_20",
      "shape": "box",
      "position": [
        0,
        0.045,
        -42.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_21",
      "shape": "box",
      "position": [
        0,
        0.045,
        -44.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_22",
      "shape": "box",
      "position": [
        0,
        0.045,
        -47.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_23",
      "shape": "box",
      "position": [
        0,
        0.045,
        -49.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_24",
      "shape": "box",
      "position": [
        0,
        0.045,
        -51.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_25",
      "shape": "box",
      "position": [
        0,
        0.045,
        -53.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_26",
      "shape": "box",
      "position": [
        0,
        0.045,
        -56.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_27",
      "shape": "box",
      "position": [
        0,
        0.045,
        -58.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_28",
      "shape": "box",
      "position": [
        0,
        0.045,
        -60.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_29",
      "shape": "box",
      "position": [
        0,
        0.045,
        -62.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_30",
      "shape": "box",
      "position": [
        0,
        0.045,
        -65.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_1_31",
      "shape": "box",
      "position": [
        0,
        0.045,
        -67.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "road_2",
      "shape": "box",
      "position": [
        2.7,
        0.015,
        -33
      ],
      "dimensions": [
        2.36,
        0.06,
        74
      ],
      "color": "#987753",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "rail_2_-1",
      "shape": "box",
      "position": [
        2.0100000000000002,
        0.1,
        -33
      ],
      "dimensions": [
        0.085,
        0.12,
        74
      ],
      "color": "#aab1b2",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "rail_2_1",
      "shape": "box",
      "position": [
        3.39,
        0.1,
        -33
      ],
      "dimensions": [
        0.085,
        0.12,
        74
      ],
      "color": "#aab1b2",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_0",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        2.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_1",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        0.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_2",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -2.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_3",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -4.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_4",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -6.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_5",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -8.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_6",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -11.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_7",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -13.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_8",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -15.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_9",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -17.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_10",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -20.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_11",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -22.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_12",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -24.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_13",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -26.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_14",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -29.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_15",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -31.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_16",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -33.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_17",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -35.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_18",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -38.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_19",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -40.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_20",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -42.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_21",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -44.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_22",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -47.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_23",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -49.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_24",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -51.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_25",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -53.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_26",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -56.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_27",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -58.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_28",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -60.5
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_29",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -62.75
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_30",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -65.0
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tie_2_31",
      "shape": "box",
      "position": [
        2.7,
        0.045,
        -67.25
      ],
      "dimensions": [
        1.88,
        0.09,
        0.23
      ],
      "color": "#66482f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "cart_deck",
      "shape": "box",
      "position": [
        0,
        0.43,
        0
      ],
      "dimensions": [
        1.55,
        0.17,
        1.22
      ],
      "color": "#b9844f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "cart"
    },
    {
      "id": "wheel_-1_0",
      "shape": "cylinder",
      "position": [
        -0.73,
        0.22,
        -0.43
      ],
      "dimensions": [
        0.23,
        0.23,
        0.16,
        16
      ],
      "color": "#33454b",
      "rotation": [
        0,
        0,
        1.5707963267948966
      ],
      "group": "cart"
    },
    {
      "id": "wheel_-1_1",
      "shape": "cylinder",
      "position": [
        -0.73,
        0.22,
        0.43
      ],
      "dimensions": [
        0.23,
        0.23,
        0.16,
        16
      ],
      "color": "#33454b",
      "rotation": [
        0,
        0,
        1.5707963267948966
      ],
      "group": "cart"
    },
    {
      "id": "cart_edge_-1",
      "shape": "box",
      "position": [
        -0.77,
        0.54,
        0
      ],
      "dimensions": [
        0.08,
        0.15,
        1.22
      ],
      "color": "#347f78",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "cart"
    },
    {
      "id": "wheel_1_0",
      "shape": "cylinder",
      "position": [
        0.73,
        0.22,
        -0.43
      ],
      "dimensions": [
        0.23,
        0.23,
        0.16,
        16
      ],
      "color": "#33454b",
      "rotation": [
        0,
        0,
        1.5707963267948966
      ],
      "group": "cart"
    },
    {
      "id": "wheel_1_1",
      "shape": "cylinder",
      "position": [
        0.73,
        0.22,
        0.43
      ],
      "dimensions": [
        0.23,
        0.23,
        0.16,
        16
      ],
      "color": "#33454b",
      "rotation": [
        0,
        0,
        1.5707963267948966
      ],
      "group": "cart"
    },
    {
      "id": "cart_edge_1",
      "shape": "box",
      "position": [
        0.77,
        0.54,
        0
      ],
      "dimensions": [
        0.08,
        0.15,
        1.22
      ],
      "color": "#347f78",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "cart"
    },
    {
      "id": "body",
      "shape": "box",
      "position": [
        0,
        1.26,
        0
      ],
      "dimensions": [
        0.42,
        0.57,
        0.24
      ],
      "color": "#dbb45f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "avatar"
    },
    {
      "id": "head",
      "shape": "sphere",
      "position": [
        0,
        1.76,
        0.005
      ],
      "dimensions": [
        0.23,
        16,
        12
      ],
      "color": "#e7b88b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "avatar"
    },
    {
      "id": "hat",
      "shape": "sphere",
      "position": [
        0,
        1.89,
        0.005
      ],
      "dimensions": [
        0.235,
        16,
        12
      ],
      "color": "#317c80",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "avatar"
    },
    {
      "id": "leg_-1",
      "shape": "cylinder",
      "position": [
        -0.127,
        0.84,
        0
      ],
      "dimensions": [
        0.075,
        0.08,
        0.55,
        12
      ],
      "color": "#755235",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "avatar"
    },
    {
      "id": "foot_-1",
      "shape": "box",
      "position": [
        -0.127,
        0.57,
        0.04
      ],
      "dimensions": [
        0.19,
        0.13,
        0.27
      ],
      "color": "#70523b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "avatar"
    },
    {
      "id": "arm_-1",
      "shape": "cylinder",
      "position": [
        -0.32,
        1.28,
        0.005
      ],
      "dimensions": [
        0.064,
        0.07,
        0.5,
        12
      ],
      "color": "#d7ae7b",
      "rotation": [
        0,
        0,
        -0.25
      ],
      "group": "avatar"
    },
    {
      "id": "leg_1",
      "shape": "cylinder",
      "position": [
        0.127,
        0.84,
        0
      ],
      "dimensions": [
        0.075,
        0.08,
        0.55,
        12
      ],
      "color": "#755235",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "avatar"
    },
    {
      "id": "foot_1",
      "shape": "box",
      "position": [
        0.127,
        0.57,
        0.04
      ],
      "dimensions": [
        0.19,
        0.13,
        0.27
      ],
      "color": "#70523b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "avatar"
    },
    {
      "id": "arm_1",
      "shape": "cylinder",
      "position": [
        0.32,
        1.28,
        0.005
      ],
      "dimensions": [
        0.064,
        0.07,
        0.5,
        12
      ],
      "color": "#d7ae7b",
      "rotation": [
        0,
        0,
        0.25
      ],
      "group": "avatar"
    },
    {
      "id": "solid_block",
      "shape": "box",
      "position": [
        0,
        0.48,
        -13
      ],
      "dimensions": [
        1.93,
        0.9,
        0.65
      ],
      "color": "#e68431",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world",
      "dynamic": "course"
    },
    {
      "id": "bar_post_-1",
      "shape": "box",
      "position": [
        -3.6,
        0.75,
        -22
      ],
      "dimensions": [
        0.14,
        1.5,
        0.17
      ],
      "color": "#b46a36",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world",
      "dynamic": "course"
    },
    {
      "id": "bar_post_1",
      "shape": "box",
      "position": [
        -1.8000000000000003,
        0.75,
        -22
      ],
      "dimensions": [
        0.14,
        1.5,
        0.17
      ],
      "color": "#b46a36",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world",
      "dynamic": "course"
    },
    {
      "id": "low_crossbar",
      "shape": "box",
      "position": [
        -2.7,
        1.3,
        -22
      ],
      "dimensions": [
        2,
        0.18,
        0.24
      ],
      "color": "#e3a64f",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world",
      "dynamic": "course"
    },
    {
      "id": "reward",
      "shape": "sphere",
      "position": [
        2.7,
        1.45,
        -30
      ],
      "dimensions": [
        0.24,
        12,
        8
      ],
      "color": "#f7cf44",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world",
      "dynamic": "course"
    },
    {
      "id": "tree_trunk_0",
      "shape": "cylinder",
      "position": [
        -10.98984,
        1.27283,
        -65.41033
      ],
      "dimensions": [
        0.15,
        0.23,
        2.54565,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_0",
      "shape": "cone",
      "position": [
        -10.98984,
        3.13767,
        -65.41033
      ],
      "dimensions": [
        1.48003,
        2.90086,
        10
      ],
      "color": "#498047",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_1",
      "shape": "cylinder",
      "position": [
        7.09211,
        1.22711,
        -63.70689
      ],
      "dimensions": [
        0.15,
        0.23,
        2.45423,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_1",
      "shape": "cone",
      "position": [
        7.09211,
        3.02498,
        -63.70689
      ],
      "dimensions": [
        1.42688,
        2.79668,
        10
      ],
      "color": "#5c9653",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_2",
      "shape": "cylinder",
      "position": [
        -9.84796,
        1.00385,
        -18.58462
      ],
      "dimensions": [
        0.15,
        0.23,
        2.00771,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_2",
      "shape": "cone",
      "position": [
        -9.84796,
        2.47461,
        -18.58462
      ],
      "dimensions": [
        1.16727,
        2.28785,
        10
      ],
      "color": "#39734b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_3",
      "shape": "cylinder",
      "position": [
        11.62246,
        1.51687,
        -37.9424
      ],
      "dimensions": [
        0.15,
        0.23,
        3.03374,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_3",
      "shape": "cone",
      "position": [
        11.62246,
        3.73926,
        -37.9424
      ],
      "dimensions": [
        1.7638,
        3.45706,
        10
      ],
      "color": "#498047",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_4",
      "shape": "cylinder",
      "position": [
        -11.16188,
        1.42144,
        -10.06334
      ],
      "dimensions": [
        0.15,
        0.23,
        2.84287,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_4",
      "shape": "cone",
      "position": [
        -11.16188,
        3.50401,
        -10.06334
      ],
      "dimensions": [
        1.65283,
        3.23955,
        10
      ],
      "color": "#5c9653",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_5",
      "shape": "cylinder",
      "position": [
        7.52264,
        1.50945,
        -26.40198
      ],
      "dimensions": [
        0.15,
        0.23,
        3.01891,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_5",
      "shape": "cone",
      "position": [
        7.52264,
        3.72098,
        -26.40198
      ],
      "dimensions": [
        1.75518,
        3.44015,
        10
      ],
      "color": "#39734b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_6",
      "shape": "cylinder",
      "position": [
        -5.66388,
        1.49533,
        -48.33835
      ],
      "dimensions": [
        0.15,
        0.23,
        2.99066,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_6",
      "shape": "cone",
      "position": [
        -5.66388,
        3.68616,
        -48.33835
      ],
      "dimensions": [
        1.73876,
        3.40796,
        10
      ],
      "color": "#498047",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_7",
      "shape": "cylinder",
      "position": [
        9.17681,
        1.10033,
        -27.52463
      ],
      "dimensions": [
        0.15,
        0.23,
        2.20066,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_7",
      "shape": "cone",
      "position": [
        9.17681,
        2.71244,
        -27.52463
      ],
      "dimensions": [
        1.27945,
        2.50773,
        10
      ],
      "color": "#5c9653",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_8",
      "shape": "cylinder",
      "position": [
        -8.32861,
        1.53973,
        -4.94391
      ],
      "dimensions": [
        0.15,
        0.23,
        3.07946,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_8",
      "shape": "cone",
      "position": [
        -8.32861,
        3.79561,
        -4.94391
      ],
      "dimensions": [
        1.79038,
        3.50915,
        10
      ],
      "color": "#39734b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_9",
      "shape": "cylinder",
      "position": [
        7.91044,
        1.51808,
        -22.76711
      ],
      "dimensions": [
        0.15,
        0.23,
        3.03615,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_9",
      "shape": "cone",
      "position": [
        7.91044,
        3.74224,
        -22.76711
      ],
      "dimensions": [
        1.76521,
        3.4598,
        10
      ],
      "color": "#498047",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_10",
      "shape": "cylinder",
      "position": [
        -10.60789,
        1.5169,
        -64.7937
      ],
      "dimensions": [
        0.15,
        0.23,
        3.0338,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_10",
      "shape": "cone",
      "position": [
        -10.60789,
        3.73934,
        -64.7937
      ],
      "dimensions": [
        1.76384,
        3.45713,
        10
      ],
      "color": "#5c9653",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_11",
      "shape": "cylinder",
      "position": [
        7.61001,
        1.26308,
        -27.7385
      ],
      "dimensions": [
        0.15,
        0.23,
        2.52617,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_11",
      "shape": "cone",
      "position": [
        7.61001,
        3.11365,
        -27.7385
      ],
      "dimensions": [
        1.4687,
        2.87865,
        10
      ],
      "color": "#39734b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_12",
      "shape": "cylinder",
      "position": [
        -8.5081,
        1.02603,
        -22.31936
      ],
      "dimensions": [
        0.15,
        0.23,
        2.05205,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_12",
      "shape": "cone",
      "position": [
        -8.5081,
        2.52928,
        -22.31936
      ],
      "dimensions": [
        1.19305,
        2.33839,
        10
      ],
      "color": "#498047",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_13",
      "shape": "cylinder",
      "position": [
        8.19154,
        1.26071,
        -53.69666
      ],
      "dimensions": [
        0.15,
        0.23,
        2.52142,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_13",
      "shape": "cone",
      "position": [
        8.19154,
        3.1078,
        -53.69666
      ],
      "dimensions": [
        1.46594,
        2.87325,
        10
      ],
      "color": "#5c9653",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_14",
      "shape": "cylinder",
      "position": [
        -9.46323,
        1.50575,
        -8.6964
      ],
      "dimensions": [
        0.15,
        0.23,
        3.01151,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_14",
      "shape": "cone",
      "position": [
        -9.46323,
        3.71186,
        -8.6964
      ],
      "dimensions": [
        1.75088,
        3.43172,
        10
      ],
      "color": "#39734b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_15",
      "shape": "cylinder",
      "position": [
        11.9118,
        0.96204,
        -47.18189
      ],
      "dimensions": [
        0.15,
        0.23,
        1.92407,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_15",
      "shape": "cone",
      "position": [
        11.9118,
        2.37153,
        -47.18189
      ],
      "dimensions": [
        1.11865,
        2.19255,
        10
      ],
      "color": "#498047",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_16",
      "shape": "cylinder",
      "position": [
        -6.27835,
        1.63224,
        -24.2232
      ],
      "dimensions": [
        0.15,
        0.23,
        3.26448,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_16",
      "shape": "cone",
      "position": [
        -6.27835,
        4.02366,
        -24.2232
      ],
      "dimensions": [
        1.89795,
        3.71999,
        10
      ],
      "color": "#5c9653",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_17",
      "shape": "cylinder",
      "position": [
        10.94676,
        1.37588,
        -32.58708
      ],
      "dimensions": [
        0.15,
        0.23,
        2.75176,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_17",
      "shape": "cone",
      "position": [
        10.94676,
        3.3917,
        -32.58708
      ],
      "dimensions": [
        1.59986,
        3.13573,
        10
      ],
      "color": "#39734b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_18",
      "shape": "cylinder",
      "position": [
        -7.54826,
        1.47227,
        -4.01152
      ],
      "dimensions": [
        0.15,
        0.23,
        2.94453,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_18",
      "shape": "cone",
      "position": [
        -7.54826,
        3.62931,
        -4.01152
      ],
      "dimensions": [
        1.71194,
        3.3554,
        10
      ],
      "color": "#498047",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_19",
      "shape": "cylinder",
      "position": [
        8.3721,
        1.65456,
        -37.10055
      ],
      "dimensions": [
        0.15,
        0.23,
        3.30911,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_19",
      "shape": "cone",
      "position": [
        8.3721,
        4.07868,
        -37.10055
      ],
      "dimensions": [
        1.9239,
        3.77085,
        10
      ],
      "color": "#5c9653",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_20",
      "shape": "cylinder",
      "position": [
        -5.69432,
        0.96331,
        -64.81028
      ],
      "dimensions": [
        0.15,
        0.23,
        1.92662,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_20",
      "shape": "cone",
      "position": [
        -5.69432,
        2.37467,
        -64.81028
      ],
      "dimensions": [
        1.12013,
        2.19545,
        10
      ],
      "color": "#39734b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_21",
      "shape": "cylinder",
      "position": [
        7.53495,
        1.10843,
        -4.46181
      ],
      "dimensions": [
        0.15,
        0.23,
        2.21685,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_21",
      "shape": "cone",
      "position": [
        7.53495,
        2.7324,
        -4.46181
      ],
      "dimensions": [
        1.28887,
        2.52618,
        10
      ],
      "color": "#498047",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_22",
      "shape": "cylinder",
      "position": [
        -8.8425,
        1.56316,
        -43.2884
      ],
      "dimensions": [
        0.15,
        0.23,
        3.12631,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_22",
      "shape": "cone",
      "position": [
        -8.8425,
        3.85336,
        -43.2884
      ],
      "dimensions": [
        1.81762,
        3.56254,
        10
      ],
      "color": "#5c9653",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_trunk_23",
      "shape": "cylinder",
      "position": [
        8.22715,
        1.4678,
        -61.70847
      ],
      "dimensions": [
        0.15,
        0.23,
        2.9356,
        8
      ],
      "color": "#73533a",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    },
    {
      "id": "tree_top_23",
      "shape": "cone",
      "position": [
        8.22715,
        3.6183,
        -61.70847
      ],
      "dimensions": [
        1.70675,
        3.34522,
        10
      ],
      "color": "#39734b",
      "rotation": [
        0,
        0,
        0
      ],
      "group": "world"
    }
  ],
  "meshCount": 175,
  "dynamic": {
    "camera": "fixed",
    "world": "fixed",
    "course": "z moves toward +z at 3.5 units/s; wrap to -65 after z>5",
    "cartAvatar": "lane center x shifts using fixed schedule below; group positions are offsets, maintain same extents"
  },
  "eventSchedule": [
    {
      "timeMs": 0,
      "lane": 0,
      "pose": "neutral"
    },
    {
      "timeMs": 1000,
      "lane": -1,
      "pose": "left_step"
    },
    {
      "timeMs": 2500,
      "lane": -1,
      "pose": "squat"
    },
    {
      "timeMs": 3500,
      "lane": 0,
      "pose": "neutral"
    },
    {
      "timeMs": 5000,
      "lane": 1,
      "pose": "right_step"
    },
    {
      "timeMs": 6500,
      "lane": 1,
      "pose": "arms_up"
    },
    {
      "timeMs": 8000,
      "lane": 0,
      "pose": "neutral"
    }
  ],
  "loopMs": 10000
};
