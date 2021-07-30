import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  LogBox,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import WS from "react-native-websocket";
import { BarCodeScanner } from "expo-barcode-scanner";
import SnackBar from "react-native-snackbar-component";
import * as Updates from "expo-updates";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import NetInfo from "@react-native-community/netinfo";

LogBox.ignoreLogs(["Animated: `useNativeDriver`"]);

export default function App() {
  const PORT = 3000;
  const wsRef = useRef(null);
  const [base64, setBase64] = useState();
  const [ipAddress, setIpAddress] = useState();
  const [hasLibraryPermission, setHasLibraryPermission] = useState();
  const [hasScannerPermission, setHasScannerPermission] = useState();
  const [isWiFi, setIsWiFi] = useState(true);
  const [scanned, setScanned] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSnack, setShowSnack] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    getUpdate();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsWiFi(state.type === "wifi");
      console.log("Connection type", state.type);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasScannerPermission(status === "granted");
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        setHasLibraryPermission(status === "granted");
      }
    })();
  }, []);

  const getUpdate = async () => {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Nova versão disponível:",
          "Deseja instalar ela agora?",
          [
            {
              text: "Não",
              onPress: () => {},
              style: "cancel",
            },
            {
              text: "Sim",
              onPress: async () => await Updates.reloadAsync(),
            },
          ],
          { cancelable: false }
        );
      }
    } catch {}
  };

  const handleBarCodeScanned = ({ data }) => {
    setScanned(true);
    setIpAddress(data);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      base64: true,
    });

    if (!result.cancelled) {
      setSending(true);
      let res = await resizeImg(result);
      console.log(
        `Compressão: ${
          (result.base64.length / (res.base64?.length || 1)) * 100
        } %`
      );
      setBase64(res.base64);
    }
  };

  const takePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      base64: true,
    });

    if (!result.cancelled) {
      setSending(true);
      let res = await resizeImg(result);
      console.log(
        `Compressão: ${
          (result.base64.length / (res.base64?.length || 1)) * 100
        } %`
      );
      setBase64(res.base64);
    }
  };

  const resizeImg = async (img) => {
    let largestDimension = img.width > img.height ? "width" : "height";
    let max = largestDimension === "width" ? img.width : img.height;
    max = max < 1000 ? max : 1000;

    const result = await ImageManipulator.manipulateAsync(
      img.uri,
      [{ resize: { [largestDimension]: max } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.PNG, base64: true }
    );

    return result;
  };

  const sendImage = (client, image) => {
    const message = ["screenshot", image].join(",");
    console.log(
      `Sending ${image.length} bytes in message ${message.length} bytes`
    );
    client.send(message, () => {
      console.log("Done");
      process.exit(0);
    });
  };

  const handleReScan = () => {
    setBase64(undefined);
    setIpAddress(undefined);
    setScanned(false);
  };

  const handleCancelUpload = () => {
    setBase64(null);
    setHasError(true);
    setSending(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {hasScannerPermission === undefined ||
      hasLibraryPermission === undefined ? (
        <ActivityIndicator color="#fff" size="large" />
      ) : !hasScannerPermission || !hasScannerPermission ? (
        <Text style={styles.txt}>
          O app não tem as permissões necessárias para funcionar.
        </Text>
      ) : (
        <>
          {!ipAddress ? (
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={[StyleSheet.absoluteFillObject, styles.scanner]}
            >
              <View style={styles.layerTop}>
                <Text style={styles.qr}>Escaneie o QR CODE</Text>
              </View>
              <View style={styles.layerCenter}>
                <View style={styles.layerLeft} />
                <View style={styles.focused} />
                <View style={styles.layerRight} />
              </View>
              <View style={styles.layerBottom} />
            </BarCodeScanner>
          ) : (
            <>
              {!isWiFi ? (
                <View style={{ alignItems: "center" }}>
                  <FontAwesome5 name="wifi" size={75} color="#fff" />
                  <Text style={[styles.txt, { marginTop: 30 }]}>
                    Ative o wi-fi.
                  </Text>
                </View>
              ) : sending ? (
                <View
                  style={{
                    alignSelf: "stretch",
                    paddingHorizontal: 20,
                    paddingVertical: 50,
                    alignItems: "center",
                    flex: 1,
                    justifyContent: "space-between",
                  }}
                >
                  <View></View>
                  <View>
                    <Text style={styles.txt}>Enviando...</Text>
                    <ActivityIndicator
                      color="#fff"
                      size="large"
                      style={{ marginTop: 15 }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleCancelUpload}
                    style={styles.btnOut}
                  >
                    <Text style={[styles.btnTxt, { marginTop: 0 }]}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View
                  style={{
                    paddingHorizontal: 20,
                    alignSelf: "stretch",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={[
                      styles.txt,
                      {
                        fontSize: 20,
                        textTransform: "uppercase",
                        fontWeight: "700",
                        marginBottom: 15,
                      },
                    ]}
                  >
                    Selecione uma imagem:
                  </Text>
                  <View style={styles.btnGroup}>
                    <TouchableOpacity onPress={pickImage} style={styles.btn}>
                      <FontAwesome5 name="images" size={75} color="#fff" />
                      <Text style={styles.btnTxt}>Pegar da galeria</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={takePhoto} style={styles.btn}>
                      <FontAwesome5 name="camera" size={75} color="#fff" />
                      <Text style={styles.btnTxt}>Tirar foto</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={handleReScan}
                    style={styles.btnOut}
                  >
                    <Text style={[styles.btnTxt, { marginTop: 0 }]}>
                      Escanear QR novamente
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.txtSub}>
                    {`Conectado à ${ipAddress?.replace("http://", "")}:${PORT}`}
                  </Text>
                </View>
              )}

              {base64 && (
                <WS
                  ref={wsRef}
                  url={`ws://${ipAddress}:${PORT}/`}
                  onOpen={(ws) => {
                    console.log("Open!");
                    setHasError(false);
                    sendImage(ws, base64);
                  }}
                  onMessage={(msg) => {
                    console.log({ msg });
                  }}
                  onError={(err) => {
                    setHasError(true);
                    console.log({ err });
                  }}
                  onClose={() => {
                    setBase64(null);
                    setShowSnack(true);
                    console.log("closed");
                    setSending(false);
                  }}
                />
              )}
            </>
          )}
        </>
      )}
      <SnackBar
        visible={showSnack}
        textMessage={
          hasError ? "Algo deu errado..." : "Imagem enviada com sucesso!"
        }
        autoHidingTime={5000}
        backgroundColor={hasError ? danger : primary}
        accentColor="#fff"
        actionHandler={() => {
          setShowSnack(false);
        }}
        actionText="OK"
      />
    </View>
  );
}
const primary = "#38f";
const danger = "#f43";
const opacity = "rgba(0, 0, 0, .75)";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  scanner: {
    flex: 1,
  },
  layerTop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: opacity,
  },
  layerCenter: {
    flex: 1,
    flexDirection: "row",
  },
  layerLeft: {
    flex: 2,
    backgroundColor: opacity,
  },
  focused: {
    flex: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  layerRight: {
    flex: 2,
    backgroundColor: opacity,
  },
  layerBottom: {
    flex: 1,
    backgroundColor: opacity,
  },
  qr: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  txt: { color: "#fff", fontSize: 15, textAlign: "center" },
  txtSub: {
    color: "#fff",
    opacity: 0.5,
    marginTop: 30,
    fontSize: 10,
  },
  btnGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  btn: {
    backgroundColor: primary,
    width: "47%",
    aspectRatio: 1,
    borderRadius: 5,
    marginVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  btnOut: {
    backgroundColor: undefined,
    width: "100%",
    height: 60,
    aspectRatio: undefined,
    borderWidth: 1,
    borderColor: primary,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  btnTxt: {
    color: "#fff",
    textTransform: "uppercase",
    textAlign: "center",
    fontWeight: "700",
    marginTop: 15,
  },
});
