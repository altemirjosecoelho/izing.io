<template>
  <div>
    <div class="row col full-width q-pa-lg">
      <q-card flat
        bordered
        class="full-width">
        <q-card-section class="text-h6 text-bold">
          Canais de Comunicação
          <q-separator />
        </q-card-section>
      </q-card>
    </div>
    <div class="row full-width q-py-lg q-px-md ">
      <template v-for="item in whatsapps">
        <q-card flat
          bordered
          class="col-xs-12 col-sm-5 col-md-4 col-lg-3 q-ma-md"
          :key="item.id">
          <q-item>
            <q-item-section avatar>
              <q-avatar>
                <q-icon size="40px"
                  :name="`img:${item.type}-logo.png`" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-h6 text-bold">Nome: {{ item.name }}</q-item-label>
              <q-item-label class="text-h6 text-caption">
                {{ item.type }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn round
                flat
                dense
                icon="edit"
                @click="handleOpenModalWhatsapp(item)"
                v-if="isAdmin" />
              <!-- <q-btn
            round
            flat
            dense
            icon="delete"
            @click="deleteWhatsapp(props.row)"
            v-if="$store.getters['isSuporte']"
          /> -->
              <!-- <q-btn
            class="q-ml-sm"
            color="black"
            icon="person_search"
            round
            flat
            dense
            @click="sincronizarContatos(props.row)"
          >
            <q-tooltip>
              Sincronizar contatos
            </q-tooltip>

          </q-btn> -->
            </q-item-section>
          </q-item>
          <q-separator />
          <q-card-section>
            <ItemStatusChannel :item="item" />
            <template v-if="item.type === 'messenger'">
              <div class="text-body2 text-bold q-mt-sm">
                <span> Página: </span>
                {{ item.fbObject && item.fbObject.name || 'Nenhuma página configurada.' }}
              </div>
            </template>
          </q-card-section>
          <q-separator />
          <q-card-actions class="q-pa-md q-pt-none"
            align="center">
            <template v-if="item.type !== 'messenger'">
              <q-btn v-if="item.status == 'DESTROYED' || item.status == 'qrcode'"
                color="blue-5"
                label="Novo QR Code"
                @click="handleRequestNewQrCode(item, 'btn-qrCode')"
                icon-right="watch_later"
                :disable="!isAdmin" />
              <q-btn-group v-if="item.status == 'DISCONNECTED'"
                outline>
                <q-btn outline
                  color="black"
                  label="Conectar"
                  @click="handleStartWhatsAppSession(item.id)" />
              </q-btn-group>
              <q-btn v-if="['CONNECTED', 'PAIRING', 'TIMEOUT', 'OPENING'].includes(item.status)"
                color="negative"
                label="Desconectar"
                outline
                @click="handleDisconectWhatsSession(item.id)"
                :disable="!isAdmin" />
              <q-btn v-if="item.status == 'OPENING'"
                disable
                :loading="true"
                color="grey"
                label="Conectando" />
            </template>
            <template v-if="item.type === 'messenger'">
              <VFacebookLogin :app-id="cFbAppId"
                @sdk-init="handleSdkInit"
                @login="login => fbLogin(login, item)"
                @logout="logout => fbLogout(item)"
                :login-options="FBLoginOptions"
                version="v12.0">
                <template slot="login">
                  {{ item.status === 'CONNECTED' ? 'Editar' : 'Conectar' }}
                </template>
                <template slot="logout">
                  {{ item.status === 'DISCONNECTED' ? 'Conectar' : 'Editar' }}
                </template>
              </VFacebookLogin>
            </template>
          </q-card-actions>
        </q-card>
      </template>
    </div>
    <ModalQrCode :abrirModalQR.sync="abrirModalQR"
      :channel="whatsappSelecionado" />
    <ModalWhatsapp :modalWhatsapp.sync="modalWhatsapp"
      :whatsAppEdit.sync="whatsappSelecionado" />
    <q-inner-loading :showing="loading">
      <q-spinner-gears size="50px"
        color="primary" />
    </q-inner-loading>
  </div>
</template>

<script>
import { DeletarWhatsapp, DeleteWhatsappSession, StartWhatsappSession, ListarWhatsapps } from 'src/service/sessoesWhatsapp'
import { format, parseISO } from 'date-fns'
import pt from 'date-fns/locale/pt-BR/index'
import ModalQrCode from './ModalQrCode'
import { mapGetters } from 'vuex'
import ModalWhatsapp from './ModalWhatsapp'
import ItemStatusChannel from './ItemStatusChannel'
import VFacebookLogin from 'vue-facebook-login-component'
import { FetchFacebookPages, LogoutFacebookPages } from 'src/service/facebook'

const userLogado = JSON.parse(localStorage.getItem('usuario'))

export default {
  name: 'IndexSessoesWhatsapp',
  components: {
    ModalQrCode,
    ModalWhatsapp,
    ItemStatusChannel,
    VFacebookLogin
  },
  data () {
    return {
      loading: false,
      userLogado,
      isAdmin: false,
      abrirModalQR: false,
      modalWhatsapp: false,
      whatsappSelecionado: {},
      whatsAppId: null,
      objStatus: {
        qrcode: ''
      },
      columns: [
        {
          name: 'name',
          label: 'Nome',
          field: 'name',
          align: 'left'
        },
        {
          name: 'status',
          label: 'Status',
          field: 'status',
          align: 'center'
        },
        {
          name: 'session',
          label: 'Sessão',
          field: 'status',
          align: 'center'
        },
        {
          name: 'number',
          label: 'Número',
          field: 'number',
          align: 'center'
        },
        {
          name: 'updatedAt',
          label: 'Última Atualização',
          field: 'updatedAt',
          align: 'center',
          format: d => this.formatarData(d, 'dd/MM/yyyy HH:mm')
        },
        {
          name: 'isDefault',
          label: 'Padrão',
          field: 'isDefault',
          align: 'center'
        },
        {
          name: 'acoes',
          label: 'Ações',
          field: 'acoes',
          align: 'center'
        }
      ],
      FB: {},
      FBscope: {},
      FBLoginOptions: {
        scope:
          'pages_manage_metadata,pages_messaging,instagram_basic,pages_show_list,pages_read_engagement,instagram_manage_messages'
      },
      FBPageList: [],
      fbSelectedPage: { name: null, id: null },
      fbPageName: '',
      fbUserToken: ''
    }
  },
  computed: {
    ...mapGetters(['whatsapps']),
    cFbAppId () {
      return process.env.fbAppId
    }
  },
  methods: {
    formatarData (data, formato) {
      return format(parseISO(data), formato, { locale: pt })
    },
    handleSdkInit ({ FB }) {
      this.FB = FB
      // try login

      // this.FBscope = scope
    },
    async fbLogout (whatsapp) {
      console.log('fbLogout')
      await LogoutFacebookPages(whatsapp)
    },
    fbLogin (login, channel) {
      if (login?.status === 'connected') {
        this.fbFetchPages(
          login.authResponse.accessToken,
          login.authResponse.userID,
          channel
        )
        console.log('fbLogin in connected')
      } else if (login?.status === 'not_authorized') {
        // The person is logged into Facebook, but not your app.
        console.log('fbLogin in not_authorized')
      } else {
        // The person is not logged into Facebook, so we're not sure if
        // they are logged into this app or not.
        console.log('fbLogin in not logged')
      }
    },
    async fbFetchPages (_token, _accountId, channel) {
      try {
        const response = await FetchFacebookPages({
          whatsapp: channel,
          userToken: _token,
          accountId: _accountId
        })
        const {
          data: { data }
        } = response
        this.FBPageList = data.page_details
        this.fbUserToken = data.user_access_token
      } catch (error) {
        // Ignore error
      }
    },
    handleOpenQrModal (channel) {
      this.whatsappSelecionado = channel
      this.abrirModalQR = true
    },
    handleOpenModalWhatsapp (whatsapp) {
      this.whatsappSelecionado = whatsapp
      this.modalWhatsapp = true
    },
    async handleDisconectWhatsSession (whatsAppId) {
      this.$q.dialog({
        title: 'Atenção!! Deseja realmente desconectar? ',
        // message: 'Mensagens antigas não serão apagadas no whatsapp.',
        cancel: {
          label: 'Não',
          color: 'primary',
          push: true
        },
        ok: {
          label: 'Sim',
          color: 'negative',
          push: true
        },
        persistent: true
      }).onOk(() => {
        this.loading = true
        DeleteWhatsappSession(whatsAppId).then(() => {
          const whatsapp = this.whatsapps.find(w => w.id === whatsAppId)
          this.$store.commit('UPDATE_WHATSAPPS', {
            ...whatsapp,
            status: whatsapp.type === 'whatsapp' ? 'DESTROYED' : 'DISCONNECTED'
          })
        }).finally(f => {
          this.loading = false
        })
      })
    },
    async handleStartWhatsAppSession (whatsAppId) {
      try {
        await StartWhatsappSession(whatsAppId)
      } catch (error) {
        console.error(error)
      }
    },
    async handleRequestNewQrCode (channel, origem) {
      console.log('origem', origem)
      if (channel.type === 'telegram' && !channel.tokenTelegram) {
        this.$notificarErro('Necessário informar o token para Telegram')
      }
      this.handleOpenQrModal(channel)
      // this.loading = true
      // try {
      //   await RequestNewQrCode(whatsapp.id)
      //   setTimeout(() => {
      //     this.handleOpenQrModal(whatsapp.id)
      //   }, 3000)
      // } catch (error) {
      //   console.error(error)
      // }
      // this.loading = false
    },
    async listarWhatsapps () {
      const { data } = await ListarWhatsapps()
      this.$store.commit('LOAD_WHATSAPPS', data)
    },
    async deleteWhatsapp (whatsapp) {
      this.$q.dialog({
        title: 'Atenção!! Deseja realmente deletar? ',
        message: 'Não é uma boa ideia apagar se já tiver gerado atendimentos para esse whatsapp.',
        cancel: {
          label: 'Não',
          color: 'primary',
          push: true
        },
        ok: {
          label: 'Sim',
          color: 'negative',
          push: true
        },
        persistent: true
      }).onOk(() => {
        this.loading = true
        DeletarWhatsapp(whatsapp.id).then(r => {
          this.$store.commit('DELETE_WHATSAPPS', whatsapp.id)
        }).finally(f => {
          this.loading = false
        })
      })
    }
  },
  mounted () {
    this.isAdmin = localStorage.getItem('profile')
    this.listarWhatsapps()
    // this.$root.$on('UPDATE_SESSION', (whatsapp) => {
    //   if (whatsapp.status === 'qrcode') {
    //     this.handleOpenQrModal(whatsapp)
    //   } else {
    //     // if (whatsapp.status === 'qrcode') return
    //     this.abrirModalQR = false
    //   }
    // })
  },
  destroyed () {
    this.$root.$off('UPDATE_SESSION')
  }
}
</script>

<style lang="scss" scoped>
</style>
