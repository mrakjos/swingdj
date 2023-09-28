import React, { Component } from "react";

import logo from "./logo.svg";
import "./App.css";

import InputNumber from "./components/InputNumber";

// import { cacheFirst } from "sw-toolbox";

const REDIRECT_URI = "http://localhost:4000/";
// const REDIRECT_URI = "https://jardakotesovec.github.io/swingdj/";

const CLIENT_ID = "d2686e8e912a4591a9c0dd7a449bf456";
const SCOPE =
  "user-read-private user-read-email playlist-read-private playlist-read-collaborative playlist-modify-private";

const DEFAULT_BPM_RANGES = [
  { min: 110, max: 120, rate: 5 },
  { min: 120, max: 140, rate: 58 },
  { min: 140, max: 160, rate: 27 },
  { min: 160, max: 180, rate: 3 },
  { min: 180, max: 200, rate: 5 },
  { min: 200, max: 230, rate: 2 }

  /*{ min: 130, max: 140, rate: 0.16 },
  { min: 140, max: 150, rate: 0.14 },
  { min: 150, max: 160, rate: 0.14 },
  { min: 160, max: 170, rate: 0.14 },
  { min: 170, max: 180, rate: 0.14 },
  { min: 180, max: 190, rate: 0.14 },
  { min: 190, max: 200, rate: 0.14 }*/
];

const DEFAULT_PLAYLIST_START = 0;
const DEFAULT_PLAYLIST_END = 100;
const DEFAULT_GROUPED_SONGS = 1;

const DEFAULT_PLAYLIST_DURATION = 3 * 60 * 60 * 1000;

function getHashParams() {
  var hashParams = {};
  var e,
    r = /([^&;=]+)=?([^&;]*)/g,
    q = window.location.hash.substring(1);
  while ((e = r.exec(q))) {
    hashParams[e[1]] = decodeURIComponent(e[2]);
  }
  return hashParams;
}

async function spotifyGet(url, access_token) {
  let headers = new Headers();
  headers.append("Authorization", "Bearer " + access_token);

  const response = await fetch(url, { headers });
  return response.json();
}

async function spotifyPost(url, payload, access_token) {
  let headers = new Headers();
  headers.append("Authorization", "Bearer " + access_token);
  headers.append("Content-Type", "application/json");

  const response = await fetch(url, {
    headers,
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.json();
}

async function fetchAll(url, itemField = "items", access_token) {
  const items = [];

  let urlToFetch = url;

  while (1) {
    const result = await spotifyGet(urlToFetch, access_token);
    Array.prototype.push.apply(items, result[itemField]);

    if (result.next) {
      urlToFetch = result.next;
    } else {
      break;
    }
  }

  return items;
}

async function fetchIds(url, _ids, itemField, limit = 100, access_token) {
  const items = [];
  const ids = _ids.slice();

  while (ids.length) {
    const idsToFetch = ids.splice(0, Math.min(100, ids.length));
    const result = await spotifyGet(
      `${url}${idsToFetch.join(",")}`,
      access_token
    );
    Array.prototype.push.apply(items, result[itemField]);
  }

  return items;
}

class App extends Component {
  constructor(props) {
    super(props);

    var params = getHashParams();

    const presetsString = localStorage.getItem("presets");
    let presetsLoaded = presetsString ? JSON.parse(presetsString) : null;

    if (!presetsLoaded) {
      presetsLoaded = [
        {
          name: "default",
          bpmRanges: DEFAULT_BPM_RANGES,
          playlistDuration: DEFAULT_PLAYLIST_DURATION,
          sourcePlaylistName: "swingdj",
          sourcePlaylist2XName: "swingdj2X",
          playlistStart: DEFAULT_PLAYLIST_START,
          playlistEnd: DEFAULT_PLAYLIST_END,
          playlistMaxGroupedSongs: DEFAULT_GROUPED_SONGS
        }
      ];
    } else {
      // set new defaults
      presetsLoaded = presetsLoaded.map(p => ({
        sourcePlaylistName: "swingdj",
        sourcePlaylist2XName: "swingdj2X",
        ...p
      }));
    }

    this.state = {
      errorMessage: null,
      access_token: params.access_token || null,
      instructions: [],
      selectedPresetIndex: 0,
      presets: presetsLoaded,
      trackSlots: []
    };
  }

  saveToLocalStorage = () => {
    const { presets } = this.state;
    localStorage.setItem("presets", JSON.stringify(presets));
  };

  handleLogin() {
    var url = "https://accounts.spotify.com/authorize";
    url += "?response_type=token";
    url += "&client_id=" + encodeURIComponent(CLIENT_ID);
    url += "&scope=" + encodeURIComponent(SCOPE);
    url += "&redirect_uri=" + encodeURIComponent(REDIRECT_URI);
    window.location = url;
  }

  handleUpdateBpmInput(property, rangeIndex, value) {
    const { presets, selectedPresetIndex } = this.state;
    const preset = presets[selectedPresetIndex];
    const { bpmRanges } = preset;
    // would be nicer to do it in immutable way.. but too much hussle
    bpmRanges[rangeIndex][property] = value;

    this.setState(
      {
        presets
      },
      () => {
        this.saveToLocalStorage();
      }
    );
  }

  handleAddRange(rangeIndex) {
    const { presets, selectedPresetIndex } = this.state;
    const preset = presets[selectedPresetIndex];
    const { bpmRanges } = preset;
    const bpmRange = bpmRanges[rangeIndex];
    bpmRanges.splice(rangeIndex + 1, 0, {
      min: bpmRange.max,
      max: bpmRange.max,
      rate: 0
    });

    this.setState({ presets }, () => {
      this.saveToLocalStorage();
    });
  }

  handleRemoveRange = rangeIndex => {
    const { presets, selectedPresetIndex } = this.state;
    const preset = presets[selectedPresetIndex];
    const { bpmRanges } = preset;
    const bpmRange = bpmRanges[rangeIndex];
    bpmRanges.splice(rangeIndex, 1);
    this.setState({ presets }, () => {
      this.saveToLocalStorage();
    });
  };

  handleDuplicatePreset = () => {
    const { presets, selectedPresetIndex } = this.state;
    const duplicatedPreset = JSON.parse(
      JSON.stringify(presets[selectedPresetIndex])
    );
    duplicatedPreset.name += " copy";
    presets.push(duplicatedPreset);

    this.setState(
      {
        presets
      },
      () => {
        this.saveToLocalStorage();
      }
    );
  };

  handleDeletePreset = () => {
    const { presets, selectedPresetIndex } = this.state;
    if (presets.length === 1) {
      return;
    }
    presets.splice(selectedPresetIndex, 1);
    this.setState({ presets, selectedPresetIndex: 0 }, () => {
      this.saveToLocalStorage();
    });
  };

  handleListPlaylists = async () => {
    const { access_token, presets, selectedPresetIndex } = this.state;

    const preset = presets[selectedPresetIndex];
    const { playlistDuration, bpmRanges } = preset;
    const sourcePlaylistName = preset.sourcePlaylistName;
    const sourcePlaylist2XName = preset.sourcePlaylist2XName;

    const playlists = await fetchAll(
      `https://api.spotify.com/v1/me/playlists?limit=50`,
      "items",
      access_token
    );
    // find swingdj playlist
    const mainPlaylist = playlists.find(p => p.name === sourcePlaylistName);
    const main2XPlaylist = playlists.find(p => p.name === sourcePlaylist2XName);

    const mpTracksAllBeforeCut = await fetchAll(
      `${mainPlaylist.tracks.href}`,
      "items",
      access_token
    );

    const sortedMpTracksAllBeforeCut = mpTracksAllBeforeCut.sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    const songsCountInOnePercent = sortedMpTracksAllBeforeCut.length / 100;
    const startIndex = Math.floor(songsCountInOnePercent * preset.playlistStart);
    const endIndex = Math.ceil(songsCountInOnePercent * preset.playlistEnd);
    const mpTracksAll = sortedMpTracksAllBeforeCut.slice(startIndex, endIndex);

    const mpTracks = mpTracksAll.filter(t => !t.is_local);
    const mpTracksLocal = mpTracksAll.filter(t => t.is_local);

    const mpTracks2X = await fetchAll(
      `${main2XPlaylist.tracks.href}`,
      "items",
      access_token
    );

    const track2XIds = mpTracks2X.map(t => t.track.id);

    const mpTrackIds = mpTracks.map(s => s.track.id);

    const mpFeatures = await fetchIds(
      "https://api.spotify.com/v1/audio-features/?ids=",
      mpTrackIds,
      "audio_features",
      100,
      access_token
    );

    const tracks = mpFeatures.map(af => {
      const tempo = track2XIds.includes(af.id) ? af.tempo * 2 : af.tempo;

      if (track2XIds.includes(af.id)) {
        console.log(af.tempo, tempo);
      }

      const trackObject = mpTracksAll.find(t => t.track.id === af.id);
      return {
        id: af.id,
        tempo,
        duration: af.duration_ms,
        uri: af.uri,
        name: trackObject.track.name,
        artists: trackObject.track.artists.map(artist => artist.name).join(', '),
        isLocal: false
      };
    });

    const instructions = [];

    // add local tracks
    mpTracksLocal.forEach(t => {
      const name = t.track.name;
      const tempo = parseFloat(name.split(" ")[0]);
      if (isNaN(tempo) || tempo < 80 || tempo > 300) {
        instructions.push(`Missing tempo for: ${name}`);
      }
      tracks.push({
        id: null,
        tempo: tempo,
        duration: t.track.duration_ms,
        uri: t.track.uri,
        name: t.track.name,
        artists: t.track.artists.map(artist => artist.name).join(', '),
        isLocal: true
      });
    });

    if (instructions.length) {
      this.setState({
        instructions
      });

      return;
    }

    const tracksInBands = bpmRanges.map(() => []);

    tracks.forEach(songInfo => {
      const index = bpmRanges.findIndex(
        br => songInfo.tempo >= br.min && songInfo.tempo < br.max
      );

      if (index > -1) {
        tracksInBands[index].push({
          ...songInfo,
          bandIndex: index
        });
      }
    });

    let currentPlaylistDuration = 0;
    let currentTrackCount = 0;
    const tracksSelected = bpmRanges.map(() => []);

    // pick the songs
    while (currentPlaylistDuration < playlistDuration) {
      // find which band needs more songs
      const rateDiffs = bpmRanges.map((br, i) =>
        currentTrackCount === 0
          ? 1
          : br.rate / 100 - tracksSelected[i].length / currentTrackCount
      );

      let rangeIndexToBeUsed = -1;
      bpmRanges.forEach((br, i) => {
        if (
          rateDiffs[i] >= 0 &&
          (rangeIndexToBeUsed === -1 ||
            bpmRanges[rangeIndexToBeUsed].rate > br.rate)
        ) {
          rangeIndexToBeUsed = i;
        }
      });

      const trackIndexToAdd = Math.floor(
        Math.random() * tracksInBands[rangeIndexToBeUsed].length
      );

      if (tracksInBands[rangeIndexToBeUsed].length === 0) {
        this.setState({
          errorMessage: `Not enough songs in bpmRange: ${
            bpmRanges[rangeIndexToBeUsed].min
          }-${bpmRanges[rangeIndexToBeUsed].max}`
        });
        return;
      }
      const trackToAdd = tracksInBands[rangeIndexToBeUsed][trackIndexToAdd];
      tracksSelected[rangeIndexToBeUsed].push(trackToAdd);
      tracksInBands[rangeIndexToBeUsed].splice(trackIndexToAdd, 1);
      currentTrackCount++;
      currentPlaylistDuration += trackToAdd.duration;
    }

    const trackSlots = [];

    const bpmRangesSorted = bpmRanges
      .map((br, i) => Object.assign({}, br, { index: i }))
      .sort((br1, br2) => {
        return br1.rate > br2.rate;
      });

    // Use track band with highest percent number and group its songs into "playlistMaxGroupedSongs" group size
    // Calculate other bands with lower percent numbers according to their values
    // If is preset.playlistMaxGroupedSongs == 1 ignore it
    const percents = bpmRanges.map(r => r.rate);
    const maxPercent = Math.max( ...percents );
    const groupSizePercent = maxPercent / preset.playlistMaxGroupedSongs;
    const tracksInBandGroupSizes = percents.map((mp) =>  Math.ceil(mp / groupSizePercent));

    let nextTracksSelected = [];
    if (preset.playlistMaxGroupedSongs > 1) {

      nextTracksSelected = tracksSelected.map((trackSelected, i) => {
        const groupSize = tracksInBandGroupSizes[i];
        const groupedSongsTrackSelected = []
        let tmpSongGroup = [];

        trackSelected.forEach(track => {
          tmpSongGroup.push(track);

          if (tmpSongGroup.length >= groupSize) {
            groupedSongsTrackSelected.push(tmpSongGroup);
            tmpSongGroup = new Array;
          }
        });
        return groupedSongsTrackSelected;
      });
    } else {
      nextTracksSelected = tracksSelected;
    }

    // fill slots with equal distribution
    bpmRangesSorted.forEach(br => {
      const bandTrackCount = tracksSelected[br.index].length;
      
      nextTracksSelected[br.index].forEach((track, j) => {
        const segmentWidth = currentTrackCount / bandTrackCount;
        const targetIndex = Math.round(j * segmentWidth + segmentWidth / 2);

        let shootRange = 0;
        while (1) {
          const leftShoot = Math.max(0, targetIndex - shootRange);
          const rightShoot = Math.min(
            currentTrackCount - 1,
            targetIndex + shootRange
          );

          if (!trackSlots[leftShoot]) {
            trackSlots[leftShoot] = track;
            break;
          }

          if (!trackSlots[rightShoot]) {
            trackSlots[rightShoot] = track;
            break;
          }
          shootRange++;
        }
      });
    });

    let nextTrackSlots = []
    if (preset.playlistMaxGroupedSongs > 1) {
      trackSlots.forEach(ts => {
        nextTrackSlots = [
          ...nextTrackSlots,
          ...ts
        ]
      })
    } else {
      nextTrackSlots = trackSlots;
    }

    this.setState({
      trackSlots: nextTrackSlots
    });

    // create new playlist
  }

  handleCreatePlaylist = async () => {
    const { access_token, trackSlots, instructions } = this.state;

    const userMe = await spotifyGet(
      "https://api.spotify.com/v1/me",
      access_token
    );
    const createPlaylist = await spotifyPost(
      `https://api.spotify.com/v1/users/${userMe.id}/playlists`,
      { name: "swingdj NEW", public: false },
      access_token
    );

    const newPlaylistId = createPlaylist.id;

    trackSlots.forEach((t, i) => {
      if (t.isLocal) {
        let afterPart = "";
        if (i > 0) {
          afterPart = `${trackSlots[i - 1].name}`;
        }
        let beforePart = "";
        if (i < trackSlots.length - 1) {
          beforePart = `${trackSlots[i + 1].name}`;
        }
        instructions.push(
          `Put "${t.name}" between "${afterPart}" AND "${beforePart}"`
        );
      }
    });

    this.setState({
      instructions,
      errorMessage: null
    });

    console.log(trackSlots.length);
    const addTracks = await spotifyPost(
      `https://api.spotify.com/v1/users/${
        userMe.id
      }/playlists/${newPlaylistId}/tracks`,
      {
        uris: trackSlots.filter(t => !t.isLocal).map(t => t.uri)
      },
      access_token
    );
    //console.log(trackSlots)

    //console.log(tracksSelected)
  };

  renderPresetsList() {
    const { presets, selectedPresetIndex } = this.state;

    return (
      <div>
        <div>
          {presets.map((preset, i) => (
            <button
              key={i}
              style={{
                backgroundColor:
                  i === selectedPresetIndex ? "#F0E68C" : "#ffffff"
              }}
              onClick={() => {
                this.setState({
                  selectedPresetIndex: i
                });
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  renderPresetControls() {
    const { presets, selectedPresetIndex } = this.state;
    const preset = presets[selectedPresetIndex];
    const { bpmRanges } = preset;
    let totalRate = 0;

    bpmRanges.forEach(bpmRange => (totalRate += bpmRange.rate));

    return (
      <div style={{ textAlign: "left" }}>
        <table>
          <tbody>
            <tr>
              <td>Preset Name</td>
              <td>
                <input
                  value={preset.name}
                  onChange={e => {
                    preset.name = e.target.value;
                    this.setState({ presets }, () => {
                      this.saveToLocalStorage();
                    });
                  }}
                />
              </td>
              <td />
              <td />
            </tr>
            <tr>
              <td>Playlist Duration</td>
              <td>
                <input
                  value={Math.round(preset.playlistDuration / 60000)}
                  onChange={e => {
                    preset.playlistDuration = parseInt(e.target.value) * 60000;
                    this.setState({ presets }, () => this.saveToLocalStorage());
                  }}
                />
              </td>
              <td>minutes</td>
              <td />
            </tr>
            <tr>
              <td>Source Playlist</td>
              <td>
                <input
                  value={preset.sourcePlaylistName}
                  onChange={e => {
                    preset.sourcePlaylistName = e.target.value;
                    this.setState({ presets }, () => this.saveToLocalStorage());
                  }}
                />
              </td>
              <td />
              <td />
            </tr>
            <tr>
              <td>Source 2X Playlist</td>
              <td>
                <input
                  value={preset.sourcePlaylist2XName}
                  onChange={e => {
                    preset.sourcePlaylist2XName = e.target.value;
                    this.setState({ presets }, () => this.saveToLocalStorage());
                  }}
                />
              </td>
              <td />
              <td />
            </tr>
            <tr>
              <td>Cut playlist from</td>
              <td>
                <InputNumber
                  min={0}
                  max={preset.playlistEnd - 1}
                  value={preset.playlistStart}
                  onChange={newValue => {
                    preset.playlistStart = newValue;
                    this.setState({ presets }, () => this.saveToLocalStorage());
                  }}
                />%
              </td>
              <td>to</td>
              <td>
                <InputNumber
                  min={preset.playlistStart + 1}
                  max={100}
                  value={preset.playlistEnd}
                  onChange={newValue => {
                    preset.playlistEnd = newValue;
                    this.setState({ presets }, () => this.saveToLocalStorage());
                  }}
                />%
              </td>
            </tr>
            <tr>
              <td>Group up to</td>
              <td>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={preset.playlistMaxGroupedSongs}
                  onChange={e => {
                    preset.playlistMaxGroupedSongs = Number.parseInt(e.target.value);
                    this.setState({ presets }, () => this.saveToLocalStorage());
                  }}
                />
              </td>
              <td>{preset.playlistMaxGroupedSongs}</td>
              <td>song{preset.playlistMaxGroupedSongs > 1 && 's'}</td>
            </tr>
          </tbody>
        </table>

        <table>
          <tbody>
            {bpmRanges.map((bpmRange, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={bpmRange.min}
                    onChange={e => {
                      this.handleUpdateBpmInput(
                        "min",
                        i,
                        parseInt(e.target.value)
                      );
                    }}
                  />
                </td>
                <td>
                  <input
                    value={bpmRange.max}
                    onChange={e => {
                      this.handleUpdateBpmInput(
                        "max",
                        i,
                        parseInt(e.target.value)
                      );
                    }}
                  />
                </td>
                <td>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={bpmRange.rate}
                    onChange={e => {
                      this.handleUpdateBpmInput(
                        "rate",
                        i,
                        parseInt(e.target.value)
                      );
                    }}
                  />
                </td>
                <td>{Math.round(bpmRange.rate)}%</td>
                <td>
                  <button onClick={() => this.handleAddRange(i)}>
                    Add Range
                  </button>
                </td>
                <td>
                  <button onClick={() => this.handleRemoveRange(i)}>
                    Remove Range
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td />
              <td />
              <td style={{ backgroundColor: totalRate == 100 ? "white" : "red" }}>
                {totalRate}%
              </td>
              <td />
              <td />
              <td />
            </tr>
          </tbody>
        </table>
        <div>
          {" "}
          <div style={{ textAlign: "left" }}>
            <button onClick={this.handleDuplicatePreset}>
              Duplicate Preset
            </button>
            <button onClick={this.handleDeletePreset}>Delete Preset</button>
          </div>
        </div>
      </div>
    );
  }

  renderOptions() {
    const { instructions, errorMessage, trackSlots } = this.state;

    let lastIndexOfBg = -1;
    const bgColors = ['transparent', '#ddd'];

    function msToTime(s) {
      var ms = s % 1000;
      s = (s - ms) / 1000;
      var secs = s % 60;
      s = (s - secs) / 60;
      var mins = s % 60;
      var hrs = (s - mins) / 60;
    
      return hrs + ':' + mins + ':' + secs;
      // return hrs + ':' + mins + ':' + secs + '.' + ms;
    }

    return (
      <div style={{ padding: '15px'}}>
        <div>{this.renderPresetsList()}</div>
        <div>{this.renderPresetControls()}</div>

        <div>
          <div>
            <button onClick={this.handleListPlaylists} style={{background: '#1DB954', color: 'white'}}>
              Create new playlist
            </button>
          </div>

          <div>
            {errorMessage ? (
              <span style={{ color: "red" }}>{errorMessage}</span>
            ) : null}
          </div>

          {instructions.map((instruction, index) => (
            <div key={index}>
              <p>{instruction}</p>
            </div>
          ))}

          {trackSlots.length > 0 && <div>
            <div>
              <button onClick={this.handleCreatePlaylist} style={{background: '#1DB954', color: 'white'}}>
                Save new playlist
              </button>
            </div>

            <table style={{ textAlign: "left"}}>
              <thead>
                <tr>
                  <td>Artist</td>
                  <td>Name</td>
                  <td>Range index</td>
                  <td>Duration</td>
                </tr>
              </thead>
              <tbody>
                {trackSlots.map((track, index) => {
                  
                  if (trackSlots[index].bandIndex != trackSlots[index - 1]?.bandIndex) {
                    lastIndexOfBg = (lastIndexOfBg + 1) % 2
                  }
                  
                  return (
                    <tr key={track.id || index} style={{ background: bgColors[lastIndexOfBg]}}>
                      <td>{track.artists}</td>
                      <td>{track.name}</td>
                      <td>{track.bandIndex}</td>
                      <td>{msToTime(track.duration)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
        </div>
      </div>
    );
  }

  renderLogin() {
    return (
      <div style={{ padding: '15px'}}>
        <button onClick={this.handleLogin}>Log in</button>
      </div>
    );
  }

  render() {
    const { access_token } = this.state;

    const content = access_token ? this.renderOptions() : this.renderLogin();

    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">SwingDJ (<a href="https://github.com/jardakotesovec/swingdj/blob/master/README.md">
            documentation
          </a>)</h1>
          
        </header>
        {content}
      </div>
    );
  }
}

export default App;
